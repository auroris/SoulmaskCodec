// TEMP: flat chronological dump of clan-log entries with Type, so screenshot
// lines can be matched to Type codes by timestamp.
//   node scripts/_clanlookup.mjs <world.db> [YYYY-MM-DD]   (default Apr 27-28)
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
const fmt = (d) => d ? d.toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : '(no time)';

const NAME = {};
for (const cat of Object.keys(enNames)) { const en = enNames[cat], zh = zhNames[cat]; if (!en || !zh) continue; for (const k of Object.keys(en)) if (zh[k] && en[k] && !(zh[k] in NAME)) NAME[zh[k]] = en[k]; }
const REASONS = { '无目标': 'No target', '缺材料': 'Need material', '缺种子': 'Need seed', '空间不足': 'Insufficient space', '目标太远': 'The target is too far.' };
const bridge = (s) => NAME[s] ?? REASONS[s] ?? s;
function renderText(t) {
  if (t == null) return ''; if (typeof t === 'string') return t;
  switch (t.historyType) {
    case -1: return t.displayString ?? '';
    case 0: return t.sourceString ?? t.key ?? '';
    case 1: case 2: { let s = renderText(t.sourceFmt); const a = t.arguments || []; for (let i = 0; i < a.length; i++) s = s.replaceAll('{' + (a[i].key != null ? a[i].key : i) + '}', a[i].type === 4 ? renderText(a[i].value) : String(a[i].value)); return s; }
    case 4: return String(t.sourceValue?.value ?? ''); case 11: return t.tableKey || ''; default: return `<ht=${t.historyType}>`;
  }
}
const findP = (props, name) => Array.isArray(props) ? props.find(p => p.tag.name?.value === name) : null;
const elemProps = (e) => e?.form === 'propStream' ? e.stream.properties : null;

const db = new Database(dbPath, { readonly: true });
const out = [];
for (const row of db.prepare('SELECT actor_data FROM actor_table').all()) {
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
      const date = toDate(findP(p, 'RiZhiDateTime')?.value?.binaryValue);
      const type = findP(p, 'Type')?.value;
      const msg = (findP(p, 'ParamArrayTxt')?.elements ?? []).map(x => bridge(renderText(x))).filter(Boolean).join(' / ') || '(none)';
      out.push({ date, type, msg });
    }
  }
}
out.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
// Window: Apr 27-28 2026 (UTC bounds wide enough for local).
const lo = Date.parse('2026-04-29T00:00:00Z'), hi = Date.parse('2026-05-18T00:00:00Z');
for (const e of out) {
  const ms = e.date?.getTime() ?? 0;
  if (ms < lo || ms > hi) continue;
  console.log(`Type ${String(e.type).padStart(2)} | ${fmt(e.date)} | ${e.msg}`);
}
