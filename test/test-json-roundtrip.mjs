/**
 * JSON round-trip spot-check.
 *
 * Picks representative rows from world.db that exercise different codec
 * paths (StructProperty propStream form, ArrayProperty<StructProperty>,
 * MapProperty<StructProperty,StructProperty>, embedded ObjectRef with
 * hasTerminatorTrailer, kindOnePrefix, perElementTrailings, FText
 * historyType=2, OpaqueValue/OpaqueProperty carry-through), then for each:
 *
 *   db_row → LZ4 decompress → UnrealBlob.fromBytes      → ORIGINAL_BYTES (re-encoded)
 *   blob   → blob.toJSONString                          → json string
 *   json   → UnrealBlob.fromJSONString  → toBytes       → RE_BYTES
 *   compare ORIGINAL_BYTES and RE_BYTES — expect byte-identical.
 *
 * Each picked row reports PASS or FAIL; on FAIL the first divergence is
 * printed with surrounding bytes so the bug is locatable.
 *
 * Usage: node test/test-json-roundtrip.mjs /path/to/world.db
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { UnrealBlob } from '../src/wscodec.mjs';
import { ObjectProperty } from '../src/properties/object.mjs';
import { StructProperty, StructValue } from '../src/properties/struct.mjs';
import { ArrayProperty } from '../src/properties/array.mjs';
import { SetProperty } from '../src/properties/set.mjs';
import { MapProperty } from '../src/properties/map.mjs';
import { TextProperty, FTextValue } from '../src/properties/text.mjs';
import { OpaqueProperty, OpaqueValue } from '../src/properties/opaque.mjs';
import { PropertyStream } from '../src/property-stream.mjs';

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

const origWarn = console.warn;
console.warn = () => {};

// Recursively visit every Property in a decoded tree.
function visitAllProps(stream, visit) {
  if (!(stream instanceof PropertyStream)) return;
  for (const p of stream.properties) {
    visit(p);
    // ObjectProperty: descend into ref.embedded
    if (p instanceof ObjectProperty && p.value?.embedded) visitAllProps(p.value.embedded, visit);
    // StructProperty: propStream form has a stream
    if (p instanceof StructProperty && p.value?.form === 'propStream') visitAllProps(p.value.stream, visit);
    // Array/Set elements: nested struct or ObjectRef
    if (p instanceof ArrayProperty || p instanceof SetProperty) {
      for (const e of (p.elements ?? [])) {
        if (e instanceof StructValue && e.form === 'propStream') visitAllProps(e.stream, visit);
        if (e && typeof e === 'object' && e.embedded instanceof PropertyStream) visitAllProps(e.embedded, visit);
      }
    }
    // Map entries: struct values may be propStream
    if (p instanceof MapProperty) {
      for (const ent of (p.entries ?? [])) {
        if (ent.value instanceof StructValue && ent.value.form === 'propStream') visitAllProps(ent.value.stream, visit);
      }
    }
  }
}

function decodeRow(row) {
  if (!row.actor_data || row.actor_data.byteLength < 8) return null;
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x00000002) return null;
  let inner;
  try { inner = _lz4.decompress(u8.subarray(4)); } catch { return null; }
  let blob;
  try { blob = UnrealBlob.fromBytes(inner); } catch { return null; }
  if (!blob.terminated) return null;
  return { row, inner, blob };
}

const criteria = [
  ['smallest blob (sanity)', (info, state) => {
    if (state.minLen === undefined || info.inner.length < state.minLen) {
      state.minLen = info.inner.length;
      return true;
    }
    return false;
  }],
  ['has StructProperty propStream form', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof StructProperty && p.value?.form === 'propStream') hit = true;
    });
    return hit;
  }],
  ['has ArrayProperty<StructProperty>', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof ArrayProperty && p.tag.innerType?.value === 'StructProperty') hit = true;
    });
    return hit;
  }],
  ['has MapProperty<StructProperty,StructProperty>', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof MapProperty
          && p.tag.innerType?.value === 'StructProperty'
          && p.tag.valueType?.value === 'StructProperty') hit = true;
    });
    return hit;
  }],
  ['has embedded ObjectRef with hasTerminatorTrailer', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof ObjectProperty && p.value?.hasTerminatorTrailer) hit = true;
    });
    return hit;
  }],
  ['has ObjectRef kindOnePrefix', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof ObjectProperty && p.value?.kindOnePrefix != null) hit = true;
    });
    return hit;
  }],
  ['has ArrayProperty.perElementTrailings', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof ArrayProperty && p.perElementTrailings) hit = true;
    });
    return hit;
  }],
  ['has FText historyType=2 (OrderedFormat)', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof TextProperty && p.value instanceof FTextValue && p.value.historyType === 2) hit = true;
    });
    return hit;
  }],
  ['has OpaqueProperty / OpaqueValue', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof OpaqueProperty) hit = true;
      if (p instanceof TextProperty && p.value instanceof OpaqueValue) hit = true;
    });
    return hit;
  }],
  ['has SetProperty', (info) => {
    let hit = false;
    visitAllProps(info.blob.stream, (p) => {
      if (p instanceof SetProperty) hit = true;
    });
    return hit;
  }],
];

const picks = new Map();
const state = new Map();
for (const [label] of criteria) state.set(label, {});

for (const row of rows) {
  const info = decodeRow(row);
  if (!info) continue;
  for (const [label, fn] of criteria) {
    if (picks.has(label) && label !== 'smallest blob (sanity)') continue;
    if (fn(info, state.get(label))) picks.set(label, info);
  }
}

function compareBytes(a, b) {
  if (a.length !== b.length) return { ok: false, kind: 'length', at: -1, msg: `len ${b.length} vs ${a.length}` };
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return { ok: false, kind: 'byte', at: i,
      msg: `@0x${i.toString(16)}: orig=0x${a[i].toString(16).padStart(2,'0')} re=0x${b[i].toString(16).padStart(2,'0')}` };
  }
  return { ok: true };
}
function ctxHex(buf, at, halfwidth = 16) {
  const start = Math.max(0, at - halfwidth);
  const end = Math.min(buf.length, at + halfwidth);
  return { start, hex: Array.from(buf.subarray(start, end))
    .map(b => b.toString(16).padStart(2, '0')).join(' ') };
}

let totalPass = 0, totalFail = 0;
let totalOrigBytes = 0, totalJsonBytes = 0;

console.log('=== Spot-check rows ===');
for (const [label] of criteria) {
  const pick = picks.get(label);
  if (!pick) { console.log(`  [SKIP] ${label} — no matching row found`); continue; }
  const { row, inner, blob } = pick;
  let result, jsonBytes;
  try {
    const jstr = blob.toJSONString();
    jsonBytes = jstr.length;
    const blob2 = UnrealBlob.fromJSONString(jstr);
    const reBytes = blob2.toBytes();
    const reOrig = blob.toBytes();
    const cmp = compareBytes(reOrig, reBytes);
    result = { cmp, reBytes, reOrig };
  } catch (e) {
    result = { error: e };
  }
  if (result.error) {
    console.log(`  [FAIL] ${label}  serial=${row.actor_serial}  size=${inner.length}B`);
    console.log(`         threw: ${result.error.message}`);
    if (result.error.stack) console.log(result.error.stack.split('\n').slice(0, 6).map(s => `         ${s}`).join('\n'));
    totalFail++;
    continue;
  }
  if (!result.cmp.ok) {
    console.log(`  [FAIL] ${label}  serial=${row.actor_serial}  size=${inner.length}B  json=${jsonBytes}B`);
    console.log(`         ${result.cmp.kind}-mismatch: ${result.cmp.msg}`);
    if (result.cmp.kind === 'byte') {
      const o = ctxHex(result.reOrig, result.cmp.at);
      const r = ctxHex(result.reBytes, result.cmp.at);
      console.log(`         orig @${o.start}: ${o.hex}`);
      console.log(`         re   @${r.start}: ${r.hex}`);
    } else if (result.cmp.kind === 'length') {
      console.log(`         orig length: ${result.reOrig.length}, re length: ${result.reBytes.length}`);
    }
    totalFail++;
    continue;
  }
  console.log(`  [PASS] ${label}  serial=${row.actor_serial}  bytes=${inner.length}  json=${jsonBytes}B  ratio=${(jsonBytes/inner.length).toFixed(2)}x`);
  totalPass++;
  totalOrigBytes += inner.length;
  totalJsonBytes += jsonBytes;
}

console.warn = origWarn;

console.log('');
console.log('=== Summary ===');
console.log(`  pass: ${totalPass}, fail: ${totalFail}`);
if (totalPass > 0) {
  console.log(`  total orig bytes verified: ${totalOrigBytes.toLocaleString()}`);
  console.log(`  total JSON bytes:           ${totalJsonBytes.toLocaleString()}  (${(totalJsonBytes/totalOrigBytes).toFixed(2)}x expansion)`);
}
process.exit(totalFail > 0 ? 1 : 0);
