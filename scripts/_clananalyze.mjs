// TEMP: survey clan-log (GongHuiMap > ArrayRiZhi) Type codes. For each Type,
// show recent samples with per-param FText shape + the zh->en bridged message.
//   node scripts/_clananalyze.mjs <world.db>
import { createRequire } from 'node:module';
import { UnrealBlob } from '../src/wscodec.mjs';
import { tables as enNames } from '../src/translations.en.mjs';
import { tables as zhNames } from '../src/translations.zh.mjs';
const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = process.argv[2];
const TZ = 'America/Edmonton';
const TICKS = 621355968000000000n;
const toDate = (t) => { try { const d = new Date(Number((BigInt(t) - TICKS) / 10000n)); return isNaN(d) ? null : d; } catch { return null; } };
const fmt = (d) => d ? d.toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '(no time)';

// zh->en bridge from the aligned per-language tables (same as dump-logs).
const NAME = {};
for (const cat of Object.keys(enNames)) {
  const en = enNames[cat], zh = zhNames[cat]; if (!en || !zh) continue;
  for (const k of Object.keys(en)) if (zh[k] && en[k] && !(zh[k] in NAME)) NAME[zh[k]] = en[k];
}
const REASONS = { '无目标': 'No target', '缺材料': 'Need material', '缺种子': 'Need seed', '空间不足': 'Insufficient space', '目标太远': 'The target is too far.' };
const bridge = (s) => NAME[s] ?? REASONS[s] ?? s;

function renderText(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  switch (t.historyType) {
    case -1: return t.displayString ?? '';
    case 0:  return t.sourceString ?? t.key ?? '';
    case 1: case 2: {
      let tmpl = renderText(t.sourceFmt); const a = t.arguments || [];
      for (let i = 0; i < a.length; i++) tmpl = tmpl.replaceAll('{' + (a[i].key != null ? a[i].key : i) + '}', a[i].type === 4 ? renderText(a[i].value) : String(a[i].value));
      return tmpl;
    }
    case 4: return String(t.sourceValue?.value ?? '');
    case 11: return t.tableKey || '';
    default: return `<ht=${t.historyType}>`;
  }
}
// Compact per-param shape tag for understanding structure.
function shape(ft) {
  if (ft == null) return '∅';
  const ht = ft.historyType;
  if (ht === -1) return ft.displayString == null ? 'name(∅)' : `name`;
  if (ht === 0)  return ft.namespace === 'WS' ? `state:${ft.key}` : `loc`;
  if (ht === 1 || ht === 2) return `fmt`;
  if (ht === 4)  return `num`;
  if (ht === 11) return `tbl:${ft.tableId?.value ?? ''}/${ft.tableKey}`;
  return `ht${ht}`;
}

const findP = (props, name) => Array.isArray(props) ? props.find(p => p.tag.name?.value === name) : null;
const elemProps = (e) => e?.form === 'propStream' ? e.stream.properties : null;

const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT actor_data FROM actor_table').all();
const types = new Map(); // type -> { count, samples:[{date, parts:[{shape,zh,en}], msg}] }

for (const row of rows) {
  if (!row.actor_data || row.actor_data.byteLength < 8) continue;
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  if (new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true) !== 2) continue;
  let blob; try { blob = UnrealBlob.fromBytes(_lz4.decompress(u8.subarray(4))); } catch { continue; }
  const ghm = blob.findPropertyDeep('GongHuiMap'); if (!ghm?.entries) continue;
  for (const entry of ghm.entries) {
    const cp = elemProps(entry.value); if (!cp) continue;
    const arr = findP(cp, 'ArrayRiZhi'); if (!arr?.elements?.length) continue;
    for (const el of arr.elements) {
      const p = elemProps(el); if (!p) continue;
      const type = findP(p, 'Type')?.value;
      const els = findP(p, 'ParamArrayTxt')?.elements ?? [];
      const parts = els.map(ft => { const zh = renderText(ft); return { shape: shape(ft), zh, en: bridge(zh) }; });
      const msg = parts.map(x => x.en).filter(Boolean).join(' / ') || '(no params)';
      if (!types.has(type)) types.set(type, { count: 0, samples: [] });
      const b = types.get(type); b.count++;
      b.samples.push({ date: toDate(findP(p, 'RiZhiDateTime')?.value?.binaryValue), parts, msg });
    }
  }
}

const ordered = [...types.entries()].sort((a, b) => b[1].count - a[1].count);
console.log(`Clan-log: ${ordered.length} distinct Types\n`);
for (const [type, b] of ordered) {
  const recent = b.samples.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)).slice(0, 3);
  const sig = recent[0].parts.map(p => p.shape).join(', ') || '(none)';
  console.log(`── Type ${type}  (${b.count} entries)   params: [${sig}]`);
  for (const s of recent) console.log(`     ${fmt(s.date).padEnd(20)} ${s.msg}`);
  console.log('');
}
