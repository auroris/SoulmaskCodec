/**
 * Full-db JSON round-trip test: every row in actor_table goes
 *
 *   db_row → LZ4 decompress → UnrealBlob.fromBytes      → ORIGINAL_BYTES (re-encoded)
 *   blob   → blob.toJSONString                          → json string
 *   json   → UnrealBlob.fromJSONString  → toBytes       → RE_BYTES
 *   compare ORIGINAL_BYTES and RE_BYTES — expect byte-identical.
 *
 * Since `toBytes()` always recomputes tag sizes from value bytes, we
 * compare against the freshly-encoded ORIGINAL, not the wire bytes
 * (which may carry inflated tag.sizes from the game's writer).
 *
 * Usage:
 *   npm run test:json
 *   node test/test-json-full.mjs /path/to/world.db
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { UnrealBlob } from '../src/wscodec.mjs';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.argv[2] || path.join(__dirname, '..', '..', 'world.db');
if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: database file not found: ${dbPath}`);
  process.exit(1);
}
const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT actor_serial, actor_data FROM actor_table').all();
console.log(`Database: ${dbPath}`);
console.log(`Rows: ${rows.length}`);
console.log('');

const stats = {
  total: 0,
  notUnreal: 0,
  lz4Failed: 0,
  decodeFailed: 0,
  unterminated: 0,
  jsonRoundTripThrew: 0,
  encodeThrew: 0,
  lengthMismatch: 0,
  byteMismatch: 0,
  pass: 0,
};
const failures = [];
let totalOrigBytes = 0, totalJsonBytes = 0;
const startMs = Date.now();

const origWarn = console.warn;
console.warn = () => {};

for (const row of rows) {
  stats.total++;
  if (!row.actor_data || row.actor_data.byteLength < 8) { stats.notUnreal++; continue; }
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x00000002) { stats.notUnreal++; continue; }

  let inner;
  try { inner = _lz4.decompress(u8.subarray(4)); }
  catch (e) { stats.lz4Failed++; continue; }

  let blob;
  try { blob = UnrealBlob.fromBytes(inner); }
  catch (e) { stats.decodeFailed++; failures.push({ serial: row.actor_serial, phase: 'decode-throw', msg: e.message }); continue; }

  if (!blob.terminated) { stats.unterminated++; continue; }

  let jstr, blob2;
  try { jstr = blob.toJSONString(); }
  catch (e) { stats.jsonRoundTripThrew++; failures.push({ serial: row.actor_serial, phase: 'toJSON-throw', msg: e.message }); continue; }

  try { blob2 = UnrealBlob.fromJSONString(jstr); }
  catch (e) { stats.jsonRoundTripThrew++; failures.push({ serial: row.actor_serial, phase: 'fromJSON-throw', msg: e.message }); continue; }

  let reOrig, re;
  try { reOrig = blob.toBytes(); }
  catch (e) { stats.encodeThrew++; failures.push({ serial: row.actor_serial, phase: 'encode-orig-throw', msg: e.message }); continue; }

  try { re = blob2.toBytes(); }
  catch (e) { stats.encodeThrew++; failures.push({ serial: row.actor_serial, phase: 'encode-json-throw', msg: e.message }); continue; }

  totalOrigBytes += reOrig.length;
  totalJsonBytes += jstr.length;

  if (re.length !== reOrig.length) {
    stats.lengthMismatch++;
    failures.push({ serial: row.actor_serial, phase: 'length-mismatch', msg: `re=${re.length} reOrig=${reOrig.length}` });
    continue;
  }
  let firstDiff = -1;
  for (let i = 0; i < re.length; i++) {
    if (re[i] !== reOrig[i]) { firstDiff = i; break; }
  }
  if (firstDiff >= 0) {
    stats.byteMismatch++;
    const ctxStart = Math.max(0, firstDiff - 16);
    const ctxEnd   = Math.min(re.length, firstDiff + 16);
    const fmt = (arr) => Array.from(arr.subarray(ctxStart, ctxEnd))
      .map(b => b.toString(16).padStart(2, '0')).join(' ');
    failures.push({
      serial: row.actor_serial,
      phase: 'byte-mismatch',
      msg: `@0x${firstDiff.toString(16)}: orig=0x${reOrig[firstDiff].toString(16).padStart(2,'0')} re=0x${re[firstDiff].toString(16).padStart(2,'0')}`,
      context: { orig: fmt(reOrig), re: fmt(re), ctxStart },
    });
    continue;
  }
  stats.pass++;
}

console.warn = origWarn;
const elapsedMs = Date.now() - startMs;

if (failures.length > 0) {
  console.log(`=== Failures (${failures.length}) ===`);
  const byPhase = new Map();
  for (const f of failures) {
    if (!byPhase.has(f.phase)) byPhase.set(f.phase, []);
    byPhase.get(f.phase).push(f);
  }
  for (const [phase, list] of byPhase) {
    console.log(`  [${list.length}x] ${phase}`);
    for (const f of list.slice(0, 5)) {
      console.log(`    serial=${f.serial}: ${f.msg}`);
      if (f.context) {
        console.log(`      orig @${f.context.ctxStart}: ${f.context.orig}`);
        console.log(`      re   @${f.context.ctxStart}: ${f.context.re}`);
      }
    }
    if (list.length > 5) console.log(`    ... and ${list.length - 5} more`);
  }
  console.log('');
}

console.log('=== Summary ===');
console.log(`  Total rows:              ${stats.total}`);
console.log(`  Not unreal-properties:   ${stats.notUnreal}`);
console.log(`  LZ4 decompress failed:   ${stats.lz4Failed}`);
console.log(`  Decode failed (throw):   ${stats.decodeFailed}`);
console.log(`  Unterminated:            ${stats.unterminated}`);
console.log(`  JSON round-trip threw:   ${stats.jsonRoundTripThrew}`);
console.log(`  Encode threw:            ${stats.encodeThrew}`);
console.log(`  Length mismatch:         ${stats.lengthMismatch}`);
console.log(`  Byte mismatch:           ${stats.byteMismatch}`);
console.log(`  Round-tripped OK:        ${stats.pass}`);
if (stats.pass > 0) {
  console.log(`  Bytes verified:          ${totalOrigBytes.toLocaleString()}  (JSON: ${totalJsonBytes.toLocaleString()}, ${(totalJsonBytes/totalOrigBytes).toFixed(2)}x expansion)`);
}
console.log(`  Wall clock:              ${elapsedMs} ms`);

const fatal = stats.decodeFailed + stats.jsonRoundTripThrew + stats.encodeThrew + stats.lengthMismatch + stats.byteMismatch;
process.exit(fatal > 0 ? 1 : 0);
