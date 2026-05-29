// TEMP: inspect work-log entry structure + container-name FText.
import { createRequire } from 'node:module';
import { UnrealBlob } from '../src/wscodec.mjs';
const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = process.argv[2];
const SERIAL = 14157;
const db = new Database(dbPath, { readonly: true });
const row = db.prepare('SELECT actor_data FROM actor_table WHERE actor_serial = ?').get(SERIAL);
const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
const blob = UnrealBlob.fromBytes(_lz4.decompress(u8.subarray(4)));

const findP = (props, name) => Array.isArray(props) ? props.find(p => p.tag.name?.value === name) : null;
const log = blob.findPropertyDeep('JingYingRiZhiList');
console.log(`JingYingRiZhiList: ${log.elements.length} entries`);

const ftSummary = (ft) => {
  if (ft == null) return 'null';
  const ht = ft.historyType;
  if (ht === -1) return `[-1 displayString=${JSON.stringify(ft.displayString)}]`;
  if (ht === 0)  return `[0 ns=${JSON.stringify(ft.namespace)} key=${JSON.stringify(ft.key)} src=${JSON.stringify(ft.sourceString)}]`;
  if (ht === 1 || ht === 2) return `[${ht} fmt=${JSON.stringify(ft.sourceFmt?.text)} nargs=${ft.arguments?.length}]`;
  if (ht === 11) return `[11 tableId=${JSON.stringify(ft.tableId?.value ?? ft.tableId)} key=${JSON.stringify(ft.tableKey)}]`;
  return `[ht=${ht}]`;
};

// Tally types, and collect entries whose any param mentions 大木箱.
const typeCount = {};
let firstType4 = null, chestEntry = null;
for (const elem of log.elements) {
  const p = elem?.form === 'propStream' ? elem.stream.properties : null;
  if (!p) continue;
  const type = findP(p, 'Type')?.value;
  typeCount[type] = (typeCount[type] || 0) + 1;
  const pat = findP(p, 'ParamArrayTxt');
  const els = pat?.elements ?? [];
  if (type === 4 && !firstType4) firstType4 = { p, els };
  if (!chestEntry && els.some(e => String(e?.text ?? '').includes('大木箱'))) chestEntry = { p, els, type };
}
console.log('Type counts:', JSON.stringify(typeCount));

function dumpEntry(label, e) {
  if (!e) { console.log(`\n${label}: none`); return; }
  console.log(`\n${label} (Type ${findP(e.p,'Type')?.value}) — all properties:`);
  for (const prop of e.p) {
    const name = prop.tag.name?.value;
    const t = prop.tag.type?.value ?? prop.tag.type;
    let s; try { s = JSON.stringify(prop.value ?? prop.elements ?? null)?.slice(0, 100); } catch { s = '(?)'; }
    console.log(`   ${String(name).padEnd(18)} [${t}] -> ${s}`);
  }
  console.log(`   ParamArrayTxt elements (${e.els.length}):`);
  e.els.forEach((ft, i) => console.log(`     [${i}] ${ftSummary(ft)}`));
}

// For each distinct Type, show the first entry's params in full detail.
const seen = new Set();
console.log('\n── First entry of each Type: ParamArrayTxt FText shapes ──');
for (const elem of log.elements) {
  const p = elem?.form === 'propStream' ? elem.stream.properties : null;
  if (!p) continue;
  const type = findP(p, 'Type')?.value;
  if (seen.has(type)) continue;
  seen.add(type);
  const els = findP(p, 'ParamArrayTxt')?.elements ?? [];
  console.log(`\n  Type ${type}:`);
  els.forEach((ft, i) => console.log(`    [${i}] ${ftSummary(ft)}`));
}
