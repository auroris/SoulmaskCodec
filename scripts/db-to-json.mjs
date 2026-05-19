#!/usr/bin/env node
/**
 * Full Soulmask world.db -> JSON export.
 *
 *   node scripts/db-to-json.mjs <path-to-world.db> [output.json]
 *
 * Walks every table in sqlite_master. For each row:
 *   - INTEGER/REAL/TEXT cells -> JSON primitives. INTEGER values outside the
 *     safe-integer range are emitted as { "$bigint": "decimalString" } so the
 *     importer can re-bind them as BigInt without precision loss.
 *   - BLOB cells -> { "$blob": "base64..." }, with one structural exception:
 *     actor_table.actor_data is LZ4-decompressed and passed through wscodec's
 *     JSON converter, yielding { "blob": <UnrealBlob JSON> } for rows that
 *     decode cleanly. Rows whose actor_data isn't a wscodec blob (wrong
 *     version tag, decompression error, decode error, or null) fall back to
 *     the generic $blob form.
 *   - NULL -> JSON null.
 *
 * Output is streamed row-by-row so a multi-hundred-MB JSON doesn't blow Node's
 * heap. Pass `--pretty` (after the paths) for indented output.
 *
 * The exported JSON, fed to scripts/json-to-db.mjs, produces a new SQLite db
 * whose actor_table.actor_data column round-trips byte-identical (uncompressed,
 * since LZ4 has multiple valid encodings for the same payload).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { UnrealBlob, blobToJSON, jsonReplacer } from '../wscodec.mjs';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const args = process.argv.slice(2).filter(a => a !== '--pretty');
const pretty = process.argv.includes('--pretty');
const dbPath = args[0];
const outPath = args[1] || (dbPath ? dbPath.replace(/\.db$/i, '') + '.json' : null);
if (!dbPath || !outPath) {
  console.error('Usage: node scripts/db-to-json.mjs <path-to-world.db> [output.json] [--pretty]');
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: database file not found: ${dbPath}`);
  process.exit(1);
}

// ── Open db with safeIntegers so >2^53 INTEGER values come back as BigInt ──
const db = new Database(dbPath, { readonly: true });
db.defaultSafeIntegers(true);

const sqliteMaster = db.prepare(`
  SELECT type, name, tbl_name, sql FROM sqlite_master
  WHERE name NOT LIKE 'sqlite_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name
`).all().map(r => ({
  type: r.type,
  name: r.name,
  tbl_name: r.tbl_name,
  sql: r.sql,
}));

const tableNames = sqliteMaster.filter(r => r.type === 'table').map(r => r.name);
// sqlite_sequence is needed to preserve AUTOINCREMENT counters; it's a system
// table (auto-managed by SQLite) and isn't reported by the "NOT LIKE" filter
// above, but its rows still need to round-trip so AUTOINCREMENT picks up where
// it left off in the reconstructed db.
const hasSqliteSequence = db.prepare("SELECT name FROM sqlite_master WHERE name = 'sqlite_sequence'").get();
if (hasSqliteSequence) tableNames.push('sqlite_sequence');

console.log(`Source: ${dbPath}`);
console.log(`Tables: ${tableNames.join(', ')}`);
console.log(`Output: ${outPath}`);
console.log('');

// ── Streaming writer ───────────────────────────────────────────────────────
const out = fs.createWriteStream(outPath);
function w(s) {
  // Backpressure: writes return false when the buffer fills; better-sqlite3 is
  // synchronous so we can't await drain. In practice writeStream coalesces
  // and the OS buffer absorbs the bursts here. For multi-GB exports we'd want
  // explicit drain handling; ~400MB on this db works fine.
  out.write(s);
}
function wjson(v) {
  // Use compact stringify for single values. Pretty option indents the
  // top-level object structure but rows stay one-per-line for diff sanity.
  // jsonReplacer carries -0 / Infinity / NaN through as sentinel strings
  // (since plain JSON drops the sign of -0 and turns Infinity/NaN into null).
  w(JSON.stringify(v, jsonReplacer));
}

// ── Cell -> JSON-safe value ─────────────────────────────────────────────────
function b64(u8) { return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64'); }

function cellToJSON(v, columnContext) {
  if (v == null) return null;
  if (typeof v === 'string')  return v;
  if (typeof v === 'number')  return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'bigint') {
    // Common case: BigInt fits in Number safely; emit as plain number.
    // Otherwise mark explicitly so the importer can rebuild as BigInt.
    if (v >= -9007199254740991n && v <= 9007199254740991n) return Number(v);
    return { $bigint: v.toString() };
  }
  if (v instanceof Buffer || v instanceof Uint8Array) {
    const u8 = v instanceof Buffer ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : v;
    if (columnContext === 'actor_table.actor_data') return actorDataToJSON(u8);
    return { $blob: b64(u8) };
  }
  throw new TypeError(`cellToJSON: unsupported cell type ${typeof v} (${v?.constructor?.name})`);
}

// ── actor_data: try wscodec, fall back to raw bytes ─────────────────────────
let stats = {
  rowsTotal: 0,
  actorBlobDecoded: 0,
  actorRawFallback: 0,
};
function actorDataToJSON(u8) {
  if (u8.length === 0) return { $blob: '' };
  if (u8.length < 8)   { stats.actorRawFallback++; return { $blob: b64(u8) }; }
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x00000002) { stats.actorRawFallback++; return { $blob: b64(u8) }; }
  let inner;
  try { inner = _lz4.decompress(u8.subarray(4)); }
  catch { stats.actorRawFallback++; return { $blob: b64(u8) }; }
  let blob;
  try { blob = UnrealBlob.decode(inner); }
  catch { stats.actorRawFallback++; return { $blob: b64(u8) }; }
  if (blob.error) { stats.actorRawFallback++; return { $blob: b64(u8) }; }
  stats.actorBlobDecoded++;
  return { blob: blobToJSON(blob) };
}

// ── Emit ───────────────────────────────────────────────────────────────────
const headerJSON = {
  schema: 'wscodec-db-export/v1',
  exportedAt: new Date().toISOString(),
  source: { path: dbPath },
  sqliteMaster,
};
w('{');
if (pretty) w('\n');
// Top-level fields except `tables` (which we stream).
for (const [k, v] of Object.entries(headerJSON)) {
  w(JSON.stringify(k) + ':');
  wjson(v);
  w(',');
  if (pretty) w('\n');
}
w('"tables":{');
if (pretty) w('\n');

const startMs = Date.now();
let firstTable = true;
for (const tableName of tableNames) {
  if (!firstTable) { w(','); if (pretty) w('\n'); }
  firstTable = false;
  w(JSON.stringify(tableName) + ':{"rows":[');
  if (pretty) w('\n');

  const cols = db.prepare(`PRAGMA table_info(${quoteIdent(tableName)})`).all();
  const colNames = cols.map(c => c.name);
  const sel = db.prepare(`SELECT ${colNames.map(quoteIdent).join(', ')} FROM ${quoteIdent(tableName)}`);
  sel.raw(true);   // returns array-of-cells per row, faster than object rows

  let rowCount = 0;
  let firstRow = true;
  for (const row of sel.iterate()) {
    if (!firstRow) { w(','); if (pretty) w('\n'); }
    firstRow = false;
    const obj = {};
    for (let i = 0; i < colNames.length; i++) {
      const colName = colNames[i];
      const ctx = `${tableName}.${colName}`;
      obj[colName] = cellToJSON(row[i], ctx);
    }
    wjson(obj);
    rowCount++;
    stats.rowsTotal++;
    if (rowCount % 1000 === 0) process.stderr.write(`  ${tableName}: ${rowCount} rows\r`);
  }
  process.stderr.write(`  ${tableName}: ${rowCount} rows                \n`);
  w(']}');
}

w('}');
if (pretty) w('\n');
w('}');
out.end();
await new Promise(r => out.on('finish', r));

function quoteIdent(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

const elapsedMs = Date.now() - startMs;
const outSize = fs.statSync(outPath).size;
console.log('');
console.log('=== Export complete ===');
console.log(`  rows total:               ${stats.rowsTotal}`);
console.log(`  actor_data decoded:       ${stats.actorBlobDecoded}`);
console.log(`  actor_data raw fallback:  ${stats.actorRawFallback}`);
console.log(`  JSON size:                ${outSize.toLocaleString()} bytes`);
console.log(`  wall clock:               ${elapsedMs} ms`);
