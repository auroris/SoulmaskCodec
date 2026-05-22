/**
 * Full-db JSON-roundtrip test: every row in actor_table goes
 *
 *   db_row -> LZ4 decompress -> UnrealBlob.decode  ─► ORIGINAL_BYTES
 *   blob   -> blobToJSON     -> JSON.stringify    ─► json string
 *   json   -> JSON.parse     -> jsonToBlob        -> serialize  ─► RE_BYTES
 *   compare ORIGINAL_BYTES and RE_BYTES — expect byte-identical.
 *
 * Failures are bucketed by phase + reason and a few examples printed per bucket.
 * Exits non-zero iff at least one row fails the byte-equality check.
 *
 * Usage:
 *   npm run test:json-full
 *   node test/test-json-full.mjs /path/to/world.db
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { UnrealBlob, blobToJSONString, jsonStringToBlob } from '../src/wscodec.mjs';

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
  decodeError: 0,
  unterminated: 0,
  bodyTrailing: 0,                    // not actually skipped; counted for visibility
  jsonToBlobThrew: 0,
  serializeThrew: 0,
  lengthMismatch: 0,
  byteMismatch: 0,
  pass: 0,
};
const failures = [];                  // each: { serial, phase, msg, context? }
let totalOrigBytes = 0, totalJsonBytes = 0;
const startMs = Date.now();

for (const row of rows) {
  stats.total++;
  if (!row.actor_data || row.actor_data.byteLength < 8) { stats.notUnreal++; continue; }
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x00000002) { stats.notUnreal++; continue; }
  let inner;
  try { inner = _lz4.decompress(u8.subarray(4)); }
  catch (e) { stats.decodeError++; failures.push({ serial: row.actor_serial, phase: 'lz4-decompress', msg: e.message }); continue; }
  let blob;
  try { blob = UnrealBlob.decode(inner); }
  catch (e) { stats.decodeError++; failures.push({ serial: row.actor_serial, phase: 'decode-throw', msg: e.message }); continue; }
  if (blob.error)         { stats.decodeError++; failures.push({ serial: row.actor_serial, phase: 'decode-error', msg: blob.error }); continue; }
  if (!blob.terminated)   { stats.unterminated++; continue; }
  if (blob.bodyTrailing && blob.bodyTrailing.length > 0) stats.bodyTrailing++;

  let jstr, blob2;
  try {
    jstr = blobToJSONString(blob);
  } catch (e) {
    stats.jsonToBlobThrew++;
    failures.push({ serial: row.actor_serial, phase: 'blobToJSON-throw', msg: e.message });
    continue;
  }
  try {
    blob2 = jsonStringToBlob(jstr);
  } catch (e) {
    stats.jsonToBlobThrew++;
    failures.push({ serial: row.actor_serial, phase: 'jsonToBlob-throw', msg: e.message });
    continue;
  }
  // jsonToBlob sets _recomputeSizes=true (the JSON pipeline is the editing
  // pipeline, so tag.size must be derived from actual value bytes). To
  // compare against the original meaningfully we encode the original with
  // the same recompute setting; otherwise the comparison degenerates into
  // "did we accidentally preserve every inflated tag.size from the wire".
  let reOrig, re;
  try {
    blob._dirty = true; blob._recomputeSizes = true;
    reOrig = blob.serialize();
  } catch (e) {
    stats.serializeThrew++;
    failures.push({ serial: row.actor_serial, phase: 'serialize-orig-throw', msg: e.message });
    continue;
  }
  try {
    re = blob2.serialize();
  } catch (e) {
    stats.serializeThrew++;
    failures.push({ serial: row.actor_serial, phase: 'serialize-throw', msg: e.message });
    continue;
  }

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
console.log(`  Decode errors:           ${stats.decodeError}`);
console.log(`  Unterminated:            ${stats.unterminated}`);
console.log(`  Body-trailing bytes:     ${stats.bodyTrailing}  (not skipped, just counted)`);
console.log(`  JSON conv throw:         ${stats.jsonToBlobThrew}`);
console.log(`  Serialize throw:         ${stats.serializeThrew}`);
console.log(`  Length mismatch:         ${stats.lengthMismatch}`);
console.log(`  Byte mismatch:           ${stats.byteMismatch}`);
console.log(`  Round-tripped OK:        ${stats.pass}`);
if (stats.pass > 0) {
  console.log(`  Bytes verified:          ${totalOrigBytes.toLocaleString()}  (JSON: ${totalJsonBytes.toLocaleString()}, ${(totalJsonBytes/totalOrigBytes).toFixed(2)}x expansion)`);
}
console.log(`  Wall clock:              ${elapsedMs} ms`);

const fatal = stats.jsonToBlobThrew + stats.serializeThrew + stats.lengthMismatch + stats.byteMismatch;
process.exit(fatal > 0 ? 1 : 0);
