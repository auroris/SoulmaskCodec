/**
 * JSON-roundtrip spot-check.
 *
 * Picks representative rows from world.db that exercise different codec paths
 * (StructProperty propStream form, ArrayProperty<StructProperty>,
 * MapProperty<StructProperty,StructProperty>, embedded ObjectRef with
 * hasTerminatorTrailer, kindOnePrefix, perElementTrailings, FText
 * historyType=2, and OpaqueValue carry-through), then for each:
 *
 *   db_row -> LZ4 decompress -> UnrealBlob.decode  ─► (1) ORIGINAL_BYTES
 *   blob   -> blobToJSON     -> JSON.stringify    ─► json string
 *   json   -> JSON.parse     -> jsonToBlob        -> serialize  ─► (2) RE_BYTES
 *   compare (1) and (2) — expect byte-identical.
 *
 * Each picked row is reported PASS or FAIL; on FAIL the first divergence is
 * printed with surrounding bytes so the bug is locatable.
 *
 * Usage: node test/test-json-roundtrip.mjs <path-to-world.db>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { UnrealBlob, blobToJSONString, jsonStringToBlob } from '../wscodec.mjs';

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

// ── Pick rows by feature ────────────────────────────────────────────────────
// Each criterion returns true when a decoded blob exhibits the feature.
// The picker walks rows once and grabs the first match for each criterion.
function visitAllProps(props, visit) {
  if (!Array.isArray(props)) return;
  for (const p of props) {
    visit(p);
    const v = p.value;
    if (!v || typeof v !== 'object') continue;
    if (v.embedded) visitAllProps(v.embedded, visit);
    if (v._structName && Array.isArray(v.value)) visitAllProps(v.value, visit);
    if (Array.isArray(v.elements)) {
      for (const e of v.elements) {
        if (e && e._structName && Array.isArray(e.value)) visitAllProps(e.value, visit);
        if (e && e.embedded) visitAllProps(e.embedded, visit);
      }
    }
    if (Array.isArray(v.entries)) {
      for (const ent of v.entries) {
        if (ent.value && ent.value._structName && Array.isArray(ent.value.value)) visitAllProps(ent.value.value, visit);
        if (ent.key   && ent.key._structName   && Array.isArray(ent.key.value))   visitAllProps(ent.key.value, visit);
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
  try { blob = UnrealBlob.decode(inner); } catch { return null; }
  if (blob.error) return null;
  return { row, inner, blob };
}

// Criteria, in priority order. Each picks ONE row.
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
    visitAllProps(info.blob.properties, (p) => {
      if (p.tag?.type?.value === 'StructProperty' && Array.isArray(p.value?.value)) hit = true;
    });
    return hit;
  }],
  ['has ArrayProperty<StructProperty>', (info) => {
    let hit = false;
    visitAllProps(info.blob.properties, (p) => {
      if (p.tag?.type?.value === 'ArrayProperty' && p.tag.innerType?.value === 'StructProperty') hit = true;
    });
    return hit;
  }],
  ['has MapProperty<StructProperty,StructProperty>', (info) => {
    let hit = false;
    visitAllProps(info.blob.properties, (p) => {
      if (p.tag?.type?.value === 'MapProperty'
          && p.tag.innerType?.value === 'StructProperty'
          && p.tag.valueType?.value === 'StructProperty') hit = true;
    });
    return hit;
  }],
  ['has embedded ObjectRef with hasTerminatorTrailer', (info) => {
    let hit = false;
    visitAllProps(info.blob.properties, (p) => {
      if (p.value?.hasTerminatorTrailer) hit = true;
    });
    return hit;
  }],
  ['has ObjectRef kindOnePrefix', (info) => {
    let hit = false;
    visitAllProps(info.blob.properties, (p) => {
      if (p.value?._kindOnePrefix != null) hit = true;
    });
    return hit;
  }],
  ['has ArrayValue._perElementTrailings', (info) => {
    let hit = false;
    visitAllProps(info.blob.properties, (p) => {
      if (p.value?._perElementTrailings) hit = true;
    });
    return hit;
  }],
  ['has FText historyType=2 (ArgumentFormat)', (info) => {
    let hit = false;
    visitAllProps(info.blob.properties, (p) => {
      const v = p.value;
      if (v && v.historyType === 2) hit = true;
    });
    return hit;
  }],
  ['has OpaqueValue (codec carry-through)', (info) => {
    let hit = false;
    visitAllProps(info.blob.properties, (p) => {
      if (p.value?.constructor?.name === 'OpaqueValue') hit = true;
    });
    return hit;
  }],
  ['has SetProperty', (info) => {
    let hit = false;
    visitAllProps(info.blob.properties, (p) => {
      if (p.tag?.type?.value === 'SetProperty') hit = true;
    });
    return hit;
  }],
];

const picks = new Map();          // label -> { row, inner, blob }
const state = new Map();          // label -> per-criterion state (for smallest)
for (const [label] of criteria) state.set(label, {});

for (const row of rows) {
  const info = decodeRow(row);
  if (!info) continue;
  for (const [label, fn] of criteria) {
    if (picks.has(label) && label !== 'smallest blob (sanity)') continue;
    if (fn(info, state.get(label))) picks.set(label, info);
  }
}

// ── Run the round-trip per pick ─────────────────────────────────────────────
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
    const jstr = blobToJSONString(blob);
    jsonBytes = jstr.length;
    const blob2 = jsonStringToBlob(jstr);
    const reBytes = blob2.serialize();
    const cmp = compareBytes(inner, reBytes);
    result = { cmp, reBytes };
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
      const o = ctxHex(inner, result.cmp.at);
      const r = ctxHex(result.reBytes, result.cmp.at);
      console.log(`         orig @${o.start}: ${o.hex}`);
      console.log(`         re   @${r.start}: ${r.hex}`);
    } else if (result.cmp.kind === 'length') {
      console.log(`         orig length: ${inner.length}, re length: ${result.reBytes.length}`);
    }
    totalFail++;
    continue;
  }
  console.log(`  [PASS] ${label}  serial=${row.actor_serial}  bytes=${inner.length}  json=${jsonBytes}B  ratio=${(jsonBytes/inner.length).toFixed(2)}x`);
  totalPass++;
  totalOrigBytes += inner.length;
  totalJsonBytes += jsonBytes;
}

console.log('');
console.log('=== Summary ===');
console.log(`  pass: ${totalPass}, fail: ${totalFail}`);
if (totalPass > 0) {
  console.log(`  total orig bytes verified: ${totalOrigBytes.toLocaleString()}`);
  console.log(`  total JSON bytes:           ${totalJsonBytes.toLocaleString()}  (${(totalJsonBytes/totalOrigBytes).toFixed(2)}x expansion)`);
}
process.exit(totalFail > 0 ? 1 : 0);
