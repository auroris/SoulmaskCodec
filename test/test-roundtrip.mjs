/**
 * Test: byte-identical round-trip for every actor_data property stream.
 *
 * For every row in world.db:
 *   1. LZ4-decompress + decode the property stream (UnrealBlob.decode).
 *   2. Re-encode the inner version tag + property stream into a fresh buffer.
 *   3. Compare the re-encoded bytes to the original decompressed bytes.
 *
 * The LZ4 layer is intentionally skipped: LZ4 has many valid encodings for
 * the same payload, so the outer compressed bytes aren't byte-stable. The
 * decompressed property stream IS the canonical form, so that's what we
 * compare against.
 *
 * Rows are categorized into:
 *
 *   notProperties        Empty blobs / json-wrapped / non-unreal headers.
 *                        Nothing to round-trip.
 *   decodeError          Decode threw or recorded an error.
 *   unterminated         Decode OK but property stream didn't end on None.
 *                        Encoder always emits None, so round-trip can't be
 *                        byte-identical for these; skip.
 *   bodyTrailing         Decode OK, terminated, but extra bytes after None
 *                        that the encoder won't reproduce; skip.
 *   skippedMismatch      Some property in the tree carries _sizeMismatch.
 *                        writePropertyStream refuses to re-emit those;
 *                        skip and tally by (name|type|subtype) with delta
 *                        distribution and parsed-value shape, so the report
 *                        points at the specific decoder branch to fix.
 *   roundTripOK          Re-encoded bytes match the original decompressed
 *                        bytes exactly.
 *   roundTripFail        Anything else: the regression tripwire. The exit
 *                        code is non-zero iff this count is non-zero.
 *
 * Usage:
 *   npm test                                 (looks for world.db two dirs up)
 *   node test/test-roundtrip.mjs /path/to/world.db
 *
 * The test requires a Soulmask `world.db`. Point it at one with the path
 * argument; the default location assumes wscodec is checked out as a
 * sibling subdir of a project that has world.db at its root.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { Writer } from '../io.mjs';
import { writePropertyStream } from '../properties.mjs';
import { UnrealBlob } from '../wscodec.mjs';

// wscodec itself takes uncompressed bytes; this test handles LZ4 inline.
// `lz4-wasm-nodejs` is a devDependency just for the test.
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

// Recursively visit every Property in a decoded tree (top-level properties,
// embedded ObjectRef streams, StructProperty streams, ArrayProperty<Struct>
// elements, MapProperty struct-value streams). Used to enumerate every
// _sizeMismatch in a row so skipsByProperty captures the FULL distribution,
// not just the first-encountered property name from the encoder throw.
function visitProperties(properties, visit) {
  if (!Array.isArray(properties)) return;
  for (const p of properties) {
    visit(p);
    const v = p.value;
    if (v == null) continue;
    // ObjectRef with embedded property stream.
    if (v.embedded) visitProperties(v.embedded, visit);
    // StructValue: value is either a property array (unknown struct) or a
    // plain binary record (known struct via STRUCT_HANDLERS); skip the
    // latter, recurse the former.
    if (v._structName && Array.isArray(v.value)) visitProperties(v.value, visit);
    // ArrayProperty / SetProperty elements: when innerType is StructProperty
    // the elements are StructValues whose .value is a nested stream.
    if (Array.isArray(v.elements)) {
      for (const e of v.elements) {
        if (e && e._structName && Array.isArray(e.value)) visitProperties(e.value, visit);
        // ObjectRef inside an array element (innerType=ObjectProperty)
        if (e && e.embedded) visitProperties(e.embedded, visit);
      }
    }
    // MapProperty struct-value streams.
    if (Array.isArray(v.entries)) {
      for (const ent of v.entries) {
        const ev = ent.value;
        if (ev && ev._structName && Array.isArray(ev.value)) visitProperties(ev.value, visit);
      }
    }
  }
}

const stats = {
  total: 0,
  notProperties: 0,
  decodeError: 0,
  unterminated: 0,
  bodyTrailing: 0,
  skippedMismatch: 0,
  roundTripOK: 0,
  roundTripFail: 0,
};
// Mismatch aggregation: key = `name|type|subtype` → diagnostic record. Subtype
// is the type-specific qualifier from the tag (structName, innerType,
// valueType, enumName) so a property that's an Array<Int> vs Array<Struct>
// gets tallied separately even when the property name is the same.
const mismatchAgg = new Map();
const failures = [];

// Compact descriptor for what `readValue` parsed the value AS, used in the
// _sizeMismatch report. The goal is to pin down which codec branch produced
// the wrong-size value: an OpaqueValue means the codec gave up and captured
// raw bytes (but somehow still tallied wrong); a StructValue<X> means the
// X struct handler / nested stream returned the wrong byte count; etc.
function describeValueShape(v) {
  if (v == null) return 'null';
  const t = typeof v;
  if (t !== 'object') return t;
  if (v instanceof Uint8Array) return `Uint8Array[${v.length}]`;
  if (Array.isArray(v)) return `Array[${v.length}]`;
  const cn = v.constructor?.name || 'object';
  if (cn === 'StructValue') {
    const inner = Array.isArray(v.value) ? `propStream[${v.value.length}]` : typeof v.value;
    return `StructValue<${v._structName}>(${inner})${v._structDecodeError ? '!err' : ''}`;
  }
  if (cn === 'ArrayValue') return `ArrayValue[${v.elements?.length ?? 0}]`;
  if (cn === 'SetValue')   return `SetValue[${v.elements?.length ?? 0}]`;
  if (cn === 'MapValue')   return `MapValue[${v.entries?.length ?? 0}]`;
  if (cn === 'OpaqueValue') return `OpaqueValue[${v.bytes?.length ?? 0}] (${v.reason ?? ''})`;
  if (cn === 'ObjectRef') {
    const parts = [];
    if (v.path != null) parts.push('path');
    if (v.classPath != null) parts.push('class');
    if (Array.isArray(v.embedded)) parts.push(`embedded[${v.embedded.length}]`);
    return `ObjectRef(${parts.join(',') || 'kindOnly'})`;
  }
  if (cn === 'SoftObjectRef') return 'SoftObjectRef';
  if (cn === 'FTextValue')    return `FTextValue(historyType=${v.historyType})`;
  return cn;
}

const startMs = Date.now();
let totalBytes = 0;

for (const row of rows) {
  stats.total++;

  if (!row.actor_data || row.actor_data.byteLength === 0) {
    stats.notProperties++;
    continue;
  }
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  // The column wire is outer version tag (4 B) + LZ4-compressed inner.
  // Sniff the version tag and decompress to get the bytes UnrealBlob accepts.
  if (u8.length < 8 || new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true) !== 0x00000002) {
    stats.notProperties++;
    continue;
  }
  // lz4-wasm-nodejs expects the [u32 size][payload] LZ4 block starting at
  // offset 0; slice past the 4-byte outer version tag first.
  let inner;
  try {
    inner = _lz4.decompress(u8.subarray(4));
  } catch (e) {
    stats.decodeError++;
    failures.push({ serial: row.actor_serial, phase: 'lz4-decompress', msg: e.message });
    continue;
  }
  let blob;
  try {
    blob = UnrealBlob.decode(inner);
  } catch (e) {
    stats.decodeError++;
    failures.push({ serial: row.actor_serial, phase: 'decode-throw', msg: e.message });
    continue;
  }
  if (blob.error) {
    stats.decodeError++;
    failures.push({ serial: row.actor_serial, phase: 'decode-error', msg: blob.error });
    continue;
  }
  if (!blob.terminated) {
    stats.unterminated++;
    continue;
  }
  if (blob.bodyTrailing && blob.bodyTrailing.length > 0) {
    stats.bodyTrailing++;
    continue;
  }

  // Tally every _sizeMismatch found anywhere in this row. One row contributes
  // at most once per (name|type|subtype) group, so counts stay comparable
  // across runs. For each group we record: row count, distribution of
  // (expected,actual) pairs, the JS shape `readValue` produced, and a few
  // example row serials. That's enough to point at the broken decoder branch:
  //   - subtype tells you which codec path (StructProperty<Foo> vs
  //     ArrayProperty<ObjectProperty>, etc.)
  //   - delta = actual-expected: negative = under-read (decoder skipped bytes);
  //     positive = over-read (decoder consumed bytes that belonged to the next
  //     property). A consistent delta across many rows usually means a single
  //     missing/extra field.
  //   - parsedAs tells you whether the codec gave up (OpaqueValue) or returned
  //     a typed value that turned out to disagree with the tag's Size.
  const seenKeys = new Set();
  visitProperties(blob.properties, (p) => {
    if (!p._sizeMismatch || !p.name) return;
    const t = p.tag;
    const ptype = t.type?.value ?? '?';
    let subtype = null;
    switch (ptype) {
      case 'StructProperty': subtype = t.structName?.value || null; break;
      case 'ArrayProperty':
      case 'SetProperty':    subtype = t.innerType?.value || null; break;
      case 'MapProperty':    subtype = `${t.innerType?.value ?? '?'}->${t.valueType?.value ?? '?'}`; break;
      case 'ByteProperty':
      case 'EnumProperty':   subtype = t.enumName?.value || null; break;
    }
    const key = subtype ? `${p.name}|${ptype}|${subtype}` : `${p.name}|${ptype}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    let agg = mismatchAgg.get(key);
    if (!agg) {
      agg = { name: p.name, type: ptype, subtype, rows: 0, deltas: new Map(), examples: [] };
      mismatchAgg.set(key, agg);
    }
    agg.rows++;
    const exp = p._sizeMismatch.expected, act = p._sizeMismatch.actual;
    const dkey = `${exp}|${act}`;
    agg.deltas.set(dkey, (agg.deltas.get(dkey) || 0) + 1);
    if (agg.examples.length < 3) {
      agg.examples.push({ serial: row.actor_serial, parsedAs: describeValueShape(p.value) });
    }
  });
  if (seenKeys.size > 0) {
    stats.skippedMismatch++;
    continue;
  }

  // Round-trip: encode the version tag + property stream into a fresh
  // writer and compare to the original (uncompressed) input bytes.
  const orig = inner;
  let re;
  try {
    const w = new Writer(orig.length || 256);
    w.writeUint32(blob.versionTag);
    writePropertyStream(w, blob.properties, /*emitTerminatorTrailer=*/true);
    re = w.finalize();
  } catch (e) {
    stats.roundTripFail++;
    failures.push({ serial: row.actor_serial, phase: 'encode-throw', msg: e.message });
    continue;
  }
  totalBytes += orig.length;

  if (re.length !== orig.length) {
    stats.roundTripFail++;
    failures.push({
      serial: row.actor_serial,
      phase: 'length-mismatch',
      msg: `re=${re.length} orig=${orig.length}`,
    });
    continue;
  }
  let firstDiff = -1;
  for (let i = 0; i < re.length; i++) {
    if (re[i] !== orig[i]) { firstDiff = i; break; }
  }
  if (firstDiff >= 0) {
    stats.roundTripFail++;
    // Context dump: 16 bytes either side of the first divergence so a
    // failing run gives us something to bisect with.
    const ctxStart = Math.max(0, firstDiff - 16);
    const ctxEnd   = Math.min(re.length, firstDiff + 16);
    const fmt = (arr) => Array.from(arr.subarray(ctxStart, ctxEnd))
      .map(b => b.toString(16).padStart(2, '0')).join(' ');
    failures.push({
      serial: row.actor_serial,
      phase: 'byte-mismatch',
      msg: `@0x${firstDiff.toString(16)}: orig=0x${orig[firstDiff].toString(16).padStart(2,'0')} re=0x${re[firstDiff].toString(16).padStart(2,'0')}`,
      context: { orig: fmt(orig), re: fmt(re), ctxStart },
    });
    continue;
  }
  stats.roundTripOK++;
}

const elapsedMs = Date.now() - startMs;

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.log(`=== Failures (${failures.length}) ===`);
  // Group by phase so a sea of "byte-mismatch" doesn't drown out a single
  // "encode-throw". Both are real regressions, but they suggest different
  // root causes.
  const byPhase = new Map();
  for (const f of failures) {
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

if (mismatchAgg.size > 0) {
  console.log('=== Properties with _sizeMismatch (decoder bug candidates) ===');
  console.log('Per-row counts: each row contributes at most once per (name|type|subtype) group.');
  console.log('Delta = actual - expected.  Negative = under-read; positive = over-read.');
  console.log('');
  const sorted = [...mismatchAgg.values()].sort((a, b) => b.rows - a.rows);
  for (const info of sorted) {
    const typeStr = info.subtype ? `${info.type}<${info.subtype}>` : info.type;
    console.log(`  [${String(info.rows).padStart(5)}x] ${info.name}  :  ${typeStr}`);
    const deltas = [...info.deltas.entries()].sort((a, b) => b[1] - a[1]);
    for (const [d, count] of deltas.slice(0, 4)) {
      const [exp, act] = d.split('|').map(Number);
      const delta = act - exp;
      const sign = delta >= 0 ? '+' : '';
      console.log(`         ${String(count).padStart(5)}x  expected=${exp} actual=${act}  (delta ${sign}${delta})`);
    }
    if (deltas.length > 4) console.log(`         ... and ${deltas.length - 4} more delta value(s)`);
    for (const ex of info.examples) {
      console.log(`         example: serial=${ex.serial}  parsedAs=${ex.parsedAs}`);
    }
  }
  console.log('');
}

const verified = stats.roundTripOK;
const verifiableTotal = verified + stats.roundTripFail;
const pct = verifiableTotal > 0 ? (verified / verifiableTotal * 100).toFixed(2) : '0';

console.log('=== Summary ===');
console.log(`  Total rows:               ${stats.total}`);
console.log(`  Not unreal-properties:    ${stats.notProperties}`);
console.log(`  Decode errors:            ${stats.decodeError}`);
console.log(`  Unterminated:             ${stats.unterminated}`);
console.log(`  Body-trailing bytes:      ${stats.bodyTrailing}`);
console.log(`  Skipped (_sizeMismatch):  ${stats.skippedMismatch}`);
console.log(`  Round-tripped OK:         ${stats.roundTripOK}  (${pct}% of attempted)`);
console.log(`  Round-trip FAILURES:      ${stats.roundTripFail}`);
console.log(`  Bytes verified:           ${totalBytes.toLocaleString()}`);
console.log(`  Wall clock:               ${elapsedMs} ms`);

process.exit(stats.roundTripFail > 0 ? 1 : 0);
