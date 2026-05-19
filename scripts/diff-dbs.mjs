#!/usr/bin/env node
/**
 * Confirm two world.db files round-trip equivalent at the uncompressed
 * actor_data level. The LZ4 envelope is allowed to differ (multiple valid
 * encodings exist for the same payload); all other cells must match exactly.
 *
 *   node scripts/diff-dbs.mjs <original.db> <rebuilt.db>
 *
 * Exits non-zero iff any row differs structurally.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const a = process.argv[2], b = process.argv[3];
if (!a || !b) { console.error('Usage: node scripts/diff-dbs.mjs <a.db> <b.db>'); process.exit(1); }
if (!fs.existsSync(a) || !fs.existsSync(b)) { console.error('one or both files missing'); process.exit(1); }

const da = new Database(a, { readonly: true }); da.defaultSafeIntegers(true);
const db = new Database(b, { readonly: true }); db.defaultSafeIntegers(true);

// Schema must match (CREATE statements verbatim).
const schemaA = da.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
const schemaB = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
function normalize(rows) { return rows.map(r => ({...r, sql: r.sql ? r.sql.replace(/\s+/g, ' ').trim() : r.sql})); }
const sA = normalize(schemaA), sB = normalize(schemaB);
if (JSON.stringify(sA) !== JSON.stringify(sB)) {
  console.error('schema mismatch:');
  console.error('  A:', sA);
  console.error('  B:', sB);
  process.exit(1);
}
console.log('schema: identical');

const tables = sA.filter(r => r.type === 'table').map(r => r.name);
const sysTables = ['sqlite_sequence'].filter(n => da.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(n));
const allTables = [...tables, ...sysTables.filter(n => !tables.includes(n))];

let totalRows = 0, totalActorBlobs = 0, byteMismatches = 0, cellMismatches = 0;
for (const t of allTables) {
  const colA = da.prepare(`PRAGMA table_info(${q(t)})`).all().map(c => c.name);
  const rowsA = da.prepare(`SELECT ${colA.map(q).join(',')} FROM ${q(t)} ORDER BY rowid`).all();
  const rowsB = db.prepare(`SELECT ${colA.map(q).join(',')} FROM ${q(t)} ORDER BY rowid`).all();
  if (rowsA.length !== rowsB.length) {
    console.error(`${t}: row count mismatch (${rowsA.length} vs ${rowsB.length})`);
    process.exit(1);
  }
  for (let i = 0; i < rowsA.length; i++) {
    totalRows++;
    const ra = rowsA[i], rb = rowsB[i];
    for (const c of colA) {
      const va = ra[c], vb = rb[c];
      if (t === 'actor_table' && c === 'actor_data') {
        if (!compareActorData(va, vb)) {
          byteMismatches++;
          if (byteMismatches <= 5) console.error(`  ${t}.${c} rowid=${ra.actor_serial}: actor_data mismatch`);
        } else if (va != null) {
          totalActorBlobs++;
        }
      } else if (!cellEqual(va, vb)) {
        cellMismatches++;
        if (cellMismatches <= 5) console.error(`  ${t}.${c} row ${i}: cell mismatch  a=${JSON.stringify(va)} b=${JSON.stringify(vb)}`);
      }
    }
  }
  console.log(`${t}: ${rowsA.length} rows OK`);
}

console.log('');
console.log('=== Diff summary ===');
console.log(`  total rows compared:        ${totalRows}`);
console.log(`  actor_data blobs verified:  ${totalActorBlobs}`);
console.log(`  byte mismatches:            ${byteMismatches}`);
console.log(`  cell mismatches:            ${cellMismatches}`);
process.exit((byteMismatches + cellMismatches) > 0 ? 1 : 0);

function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

function cellEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'bigint' || typeof b === 'bigint') return BigInt(a) === BigInt(b);
  if (a instanceof Buffer && b instanceof Buffer) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  return false;
}

// actor_data: compare at the UNCOMPRESSED level (LZ4 isn't byte-stable).
function compareActorData(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (!(a instanceof Buffer) || !(b instanceof Buffer)) return false;
  // If neither is a valid wscodec envelope, fall back to byte-comparison.
  function inner(u) {
    if (u.length < 8) return u;
    if (u.readUInt32LE(0) !== 0x00000002) return u;
    try { return Buffer.from(_lz4.decompress(new Uint8Array(u.buffer, u.byteOffset + 4, u.length - 4))); }
    catch { return u; }
  }
  const ia = inner(a), ib = inner(b);
  if (ia.length !== ib.length) return false;
  for (let i = 0; i < ia.length; i++) if (ia[i] !== ib[i]) return false;
  return true;
}
