#!/usr/bin/env node
/**
 * Inverse of scripts/db-to-json.mjs: rebuild a SQLite world.db from a JSON
 * export.
 *
 *   node --max-old-space-size=4096 scripts/json-to-db.mjs <input.json> [output.db]
 *
 * Round-trip behavior:
 *   - actor_table.actor_data round-trips byte-identical at the UNCOMPRESSED
 *     level (i.e. the bytes after the outer 0x02 version tag + LZ4 envelope).
 *     The column bytes themselves may differ from the original because LZ4
 *     has multiple valid encodings for the same payload; that's fine — any
 *     valid LZ4 decompresses to the same bytes Soulmask consumes.
 *   - All other cells (INTEGER, REAL, TEXT, NULL, generic BLOB) round-trip
 *     verbatim.
 *
 * The importer drops indexes / triggers until after the bulk insert, which
 * cuts roughly an order of magnitude off rebuild time on this db.
 *
 * The output db is created fresh; if a file already exists at the target
 * path it is deleted first. Pass an explicit second argument to override
 * the default location (input path with .json swapped for .db).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { UnrealBlob, jsonReviver } from '../src/wscodec.mjs';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const jsonPath = process.argv[2];
const dbPath = process.argv[3] || (jsonPath ? jsonPath.replace(/\.json$/i, '') + '.db' : null);
if (!jsonPath || !dbPath) {
  console.error('Usage: node --max-old-space-size=4096 scripts/json-to-db.mjs <input.json> [output.db]');
  process.exit(1);
}
if (!fs.existsSync(jsonPath)) {
  console.error(`ERROR: input JSON not found: ${jsonPath}`);
  process.exit(1);
}
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

console.log(`Input:  ${jsonPath}`);
console.log(`Output: ${dbPath}`);
console.log('');

const t0 = Date.now();
const raw = fs.readFileSync(jsonPath, 'utf8');
const parsed = JSON.parse(raw, jsonReviver);
console.log(`Parsed JSON: ${(Date.now()-t0)} ms (${(raw.length/1e6).toFixed(0)} MB)`);

if (parsed.schema !== 'wscodec-db-export/v1') {
  console.error(`ERROR: unexpected schema ${JSON.stringify(parsed.schema)}; expected "wscodec-db-export/v1"`);
  process.exit(1);
}

// ── Open db; let it create on first write ───────────────────────────────────
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ── Create tables first, indexes/triggers AFTER bulk inserts ───────────────
const sm = parsed.sqliteMaster || [];
const tableDDL   = sm.filter(r => r.type === 'table' && r.sql);
const otherDDL   = sm.filter(r => r.type !== 'table' && r.sql);
for (const r of tableDDL) {
  db.exec(r.sql);
}

// sqlite_sequence is system-managed but the rows still need to be present
// post-load so AUTOINCREMENT continues from the right counter. SQLite refuses
// to CREATE the table directly, so we let it materialize via an AUTOINCREMENT
// column (already created by tableDDL above) and INSERT rows in the rows pass.

// ── Bulk-insert each table inside one transaction ──────────────────────────
const t1 = Date.now();
let totalRows = 0;
const totalActorBlob = { decoded: 0, raw: 0 };

// Order tables: user tables first, sqlite_sequence last. The actor_table
// inserts auto-create sqlite_sequence rows for AUTOINCREMENT counters, and
// our explicit sqlite_sequence inserts have to OVERWRITE those (not append)
// to preserve the original counter value (which can be > max(rowid) when
// rows have been deleted in the source db). We use DELETE+INSERT keyed on
// `name` rather than INSERT OR REPLACE because sqlite_sequence has no
// declared unique constraint.
const tableOrder = Object.keys(parsed.tables || {})
  .filter(n => n !== 'sqlite_sequence')
  .concat(parsed.tables?.sqlite_sequence ? ['sqlite_sequence'] : []);

for (const tableName of tableOrder) {
  const tableData = parsed.tables[tableName];
  const rows = tableData.rows || [];
  if (rows.length === 0) continue;

  const colNames = Object.keys(rows[0]);
  const placeholders = colNames.map(() => '?').join(', ');

  if (tableName === 'sqlite_sequence') {
    // Replace the auto-created rows with the originals so AUTOINCREMENT
    // resumes from the source counter.
    const delStmt = db.prepare('DELETE FROM sqlite_sequence WHERE name = ?');
    const insStmt = db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)');
    const tx = db.transaction((rs) => {
      for (const row of rs) {
        delStmt.run(row.name);
        insStmt.run(row.name, cellFromJSON(row.seq, 'sqlite_sequence.seq'));
      }
    });
    tx(rows);
    totalRows += rows.length;
    console.log(`  ${tableName}: ${rows.length} rows (replace-by-name)`);
    continue;
  }

  const insertSQL = `INSERT INTO ${quoteIdent(tableName)} (${colNames.map(quoteIdent).join(', ')}) VALUES (${placeholders})`;
  const stmt = db.prepare(insertSQL);

  const insertMany = db.transaction((rs) => {
    for (const row of rs) {
      const bound = colNames.map((c) => cellFromJSON(row[c], `${tableName}.${c}`));
      stmt.run(...bound);
    }
  });
  insertMany(rows);
  totalRows += rows.length;
  console.log(`  ${tableName}: ${rows.length} rows`);
}

console.log(`Inserts: ${(Date.now()-t1)} ms`);

// ── Restore indexes / triggers ─────────────────────────────────────────────
const t2 = Date.now();
for (const r of otherDDL) db.exec(r.sql);
if (otherDDL.length) console.log(`Indexes/triggers: ${(Date.now()-t2)} ms (${otherDDL.length} statements)`);

// ── Final tidy ─────────────────────────────────────────────────────────────
db.exec('VACUUM');
db.close();
console.log(`Total: ${(Date.now()-t0)} ms`);
console.log('');
console.log('=== Import complete ===');
console.log(`  rows inserted:           ${totalRows}`);
console.log(`  actor_data blob decoded: ${totalActorBlob.decoded}`);
console.log(`  actor_data raw:          ${totalActorBlob.raw}`);

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
function quoteIdent(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

function cellFromJSON(v, columnContext) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string')  return v;
  if (typeof v === 'number')  return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') {
    if (v.$bigint !== undefined) return BigInt(v.$bigint);
    // Structured actor_data takes priority over the $blob fallback so we
    // re-emit through wscodec when both forms are theoretically present.
    if (v.blob && columnContext === 'actor_table.actor_data') {
      const blob = UnrealBlob.fromJSON(v.blob);
      const inner = blob.toBytes();
      const lz4 = _lz4.compress(inner);
      const out = Buffer.alloc(4 + lz4.length);
      out.writeUInt32LE(0x00000002, 0);   // outer version tag
      out.set(lz4, 4);
      totalActorBlob.decoded++;
      return out;
    }
    if (v.$blob !== undefined) {
      if (columnContext === 'actor_table.actor_data') totalActorBlob.raw++;
      return Buffer.from(v.$blob, 'base64');
    }
  }
  throw new TypeError(`cellFromJSON: unsupported JSON cell at ${columnContext}: ${JSON.stringify(v).slice(0, 80)}`);
}
