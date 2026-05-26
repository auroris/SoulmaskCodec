/**
 * Test: byte-identical round-trip for every actor_data property stream.
 *
 * For every row in world.db:
 *   1. LZ4-decompress + decode (UnrealBlob.fromBytes).
 *   2. Re-encode via blob.toBytes().
 *   3. Compare the re-encoded bytes to the original decompressed bytes.
 *
 * The LZ4 layer is intentionally skipped: LZ4 has many valid encodings for
 * the same payload, so outer compressed bytes aren't byte-stable. The
 * decompressed property stream is the canonical form.
 *
 * Categories:
 *
 *   notProperties        Empty blobs / non-unreal headers. Nothing to test.
 *   lz4Failed            LZ4 decompression itself threw — not a codec issue.
 *   decodeFailed         UnrealBlob.fromBytes threw. Under the new
 *                        throw-on-size-mismatch policy this surfaces:
 *                          (a) codec bugs where our reader consumed the wrong
 *                              number of bytes for the tag's claimed size,
 *                          (b) game-side write bugs where the tag's claimed
 *                              size doesn't match the actual data.
 *                        Failures are grouped by error-message prefix so
 *                        patterns are visible at a glance.
 *   unterminated         Stream didn't end on None. toBytes always emits
 *                        None, so these can't round-trip byte-identical;
 *                        skip with a tally.
 *   encodeFailed         blob.toBytes() threw.
 *   roundTripOK          Encoded bytes match the original.
 *   roundTripFail        Encoded bytes differ — the regression tripwire.
 *                        Non-zero exit code iff this is non-zero (plus
 *                        decode/encode failures).
 *
 * Usage:
 *   npm test
 *   node test/test-roundtrip.mjs /path/to/world.db
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
  console.error('Pass the path as an argument: node test/test-roundtrip.mjs /path/to/world.db');
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true });

let rows;
try {
  rows = db.prepare('SELECT actor_serial, actor_data FROM actor_table').all();
} catch (e) {
  console.error('ERROR: could not query actor_table:', e.message);
  process.exit(1);
}

console.log(`Database: ${dbPath}`);
console.log(`Rows: ${rows.length}`);
console.log('');

const stats = {
  total: 0,
  notProperties: 0,
  lz4Failed: 0,
  decodeFailed: 0,
  unterminated: 0,
  encodeFailed: 0,
  roundTripOK: 0,
  roundTripFail: 0,
};

// Decode-failure aggregation. Bucket by the first 80 chars of the error
// message (after stripping the property-name token) so identical bug
// classes group together. Each bucket: count + a few example row serials.
const decodeBuckets = new Map();
const roundTripFailures = [];

const startMs = Date.now();
let totalBytes = 0;

// Silence the warn-channel from opaque fallbacks; the test runs non-strict
// (so we exercise as many rows as possible) and we don't need per-row
// console.warn output drowning the report.
const origWarn = console.warn;
console.warn = () => {};

function bucketKey(msg) {
  // Strip property-name and quoted strings so e.g. "'Foo' (IntProperty)"
  // and "'Bar' (IntProperty)" collapse. Truncate to keep the bucket key short.
  const stripped = String(msg)
    .replace(/'[^']*'/g, "'...'")
    .replace(/\b\d+\b/g, 'N');
  return stripped.slice(0, 100);
}

for (const row of rows) {
  stats.total++;
  if (!row.actor_data || row.actor_data.byteLength === 0) { stats.notProperties++; continue; }
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  if (u8.length < 8 ||
      new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true) !== 0x00000002) {
    stats.notProperties++;
    continue;
  }
  let inner;
  try {
    inner = _lz4.decompress(u8.subarray(4));
  } catch (e) {
    stats.lz4Failed++;
    continue;
  }

  let blob;
  try {
    blob = UnrealBlob.fromBytes(inner);
  } catch (e) {
    stats.decodeFailed++;
    const k = bucketKey(e.message);
    let b = decodeBuckets.get(k);
    if (!b) { b = { count: 0, examples: [], firstMsg: e.message }; decodeBuckets.set(k, b); }
    b.count++;
    if (b.examples.length < 3) b.examples.push(row.actor_serial);
    continue;
  }

  if (!blob.terminated) { stats.unterminated++; continue; }

  let re;
  try {
    re = blob.toBytes();
  } catch (e) {
    stats.encodeFailed++;
    roundTripFailures.push({ serial: row.actor_serial, phase: 'encode-throw', msg: e.message });
    continue;
  }

  totalBytes += inner.length;

  if (re.length !== inner.length) {
    stats.roundTripFail++;
    roundTripFailures.push({
      serial: row.actor_serial,
      phase: 'length-mismatch',
      msg: `re=${re.length} orig=${inner.length}`,
    });
    continue;
  }
  let firstDiff = -1;
  for (let i = 0; i < re.length; i++) {
    if (re[i] !== inner[i]) { firstDiff = i; break; }
  }
  if (firstDiff >= 0) {
    stats.roundTripFail++;
    const ctxStart = Math.max(0, firstDiff - 16);
    const ctxEnd   = Math.min(re.length, firstDiff + 16);
    const fmt = (arr) => Array.from(arr.subarray(ctxStart, ctxEnd))
      .map(b => b.toString(16).padStart(2, '0')).join(' ');
    roundTripFailures.push({
      serial: row.actor_serial,
      phase: 'byte-mismatch',
      msg: `@0x${firstDiff.toString(16)}: orig=0x${inner[firstDiff].toString(16).padStart(2,'0')} re=0x${re[firstDiff].toString(16).padStart(2,'0')}`,
      context: { orig: fmt(inner), re: fmt(re), ctxStart },
    });
    continue;
  }
  stats.roundTripOK++;
}

console.warn = origWarn;
const elapsedMs = Date.now() - startMs;

// ── Report ───────────────────────────────────────────────────────────────────
if (decodeBuckets.size > 0) {
  console.log(`=== Decode failures (${stats.decodeFailed} rows, ${decodeBuckets.size} distinct error patterns) ===`);
  const sorted = [...decodeBuckets.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [, b] of sorted) {
    console.log(`  [${String(b.count).padStart(5)}x] ${b.firstMsg}`);
    console.log(`         example serials: ${b.examples.join(', ')}`);
  }
  console.log('');
}

if (roundTripFailures.length > 0) {
  console.log(`=== Round-trip failures (${roundTripFailures.length}) ===`);
  const byPhase = new Map();
  for (const f of roundTripFailures) {
    if (!byPhase.has(f.phase)) byPhase.set(f.phase, []);
    byPhase.get(f.phase).push(f);
  }
  for (const [phase, list] of byPhase) {
    console.log(`  [${list.length}x] ${phase}`);
    for (const f of list.slice(0, 3)) {
      console.log(`    serial=${f.serial}: ${f.msg}`);
      if (f.context) {
        console.log(`      orig @${f.context.ctxStart}: ${f.context.orig}`);
        console.log(`      re   @${f.context.ctxStart}: ${f.context.re}`);
      }
    }
    if (list.length > 3) console.log(`    ... and ${list.length - 3} more`);
  }
  console.log('');
}

const attempted = stats.roundTripOK + stats.roundTripFail;
const pct = attempted > 0 ? (stats.roundTripOK / attempted * 100).toFixed(2) : '0';

console.log('=== Summary ===');
console.log(`  Total rows:               ${stats.total}`);
console.log(`  Not unreal-properties:    ${stats.notProperties}`);
console.log(`  LZ4 decompress failed:    ${stats.lz4Failed}`);
console.log(`  Decode failed (throw):    ${stats.decodeFailed}`);
console.log(`  Unterminated stream:      ${stats.unterminated}`);
console.log(`  Encode failed (throw):    ${stats.encodeFailed}`);
console.log(`  Round-tripped OK:         ${stats.roundTripOK}  (${pct}% of attempted)`);
console.log(`  Round-trip FAILURES:      ${stats.roundTripFail}`);
console.log(`  Bytes verified:           ${totalBytes.toLocaleString()}`);
console.log(`  Wall clock:               ${elapsedMs} ms`);

const fatal = stats.decodeFailed + stats.encodeFailed + stats.roundTripFail;
process.exit(fatal > 0 ? 1 : 0);
