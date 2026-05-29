#!/usr/bin/env node
// TEMP analysis (untracked): find NPC work-log Type codes not yet mapped in
// dump-logs.mjs WORK_LOG_TEMPLATES, and for each give concrete in-game targets
// (object, coords for `gm Go`, timestamp) plus the clan-log Type tally.
//
//   node scripts/_loganalyze.mjs <world.db>

import { createRequire } from 'node:module';
import { UnrealBlob } from '../src/wscodec.mjs';
import { npc as lookupNpc } from '../src/translations.en.mjs';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = process.argv[2];
if (!dbPath) { console.error('Usage: node scripts/_loganalyze.mjs <world.db>'); process.exit(1); }

// Known NPC work-log Types (mirror of dump-logs.mjs WORK_LOG_TEMPLATES keys).
const KNOWN = new Set([0, 1, 9, 16, 22, 23, 25, 26, 33, 34]);
const TZ = 'America/Edmonton';   // this machine's zone; matches the in-game clock

const TICKS_AT_UNIX_EPOCH = 621355968000000000n;
function ticksToDate(ticks) {
  if (ticks == null) return null;
  try { const d = new Date(Number((BigInt(ticks) - TICKS_AT_UNIX_EPOCH) / 10000n)); return Number.isNaN(d.getTime()) ? null : d; }
  catch { return null; }
}
function offLabel(d) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(d).find(p => p.type === 'timeZoneName')?.value?.replace('GMT', 'UTC') ?? '';
}
function fmtLocal(d) {
  if (!d) return '(unknown time)';
  const date = d.toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  const utc = d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  return `${date}, ${time} ${offLabel(d)}   [UTC ${utc}]`;
}
function renderText(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  switch (t.historyType) {
    case -1: return t.displayString ?? '';
    case 0:  return t.sourceString ?? t.key ?? '';
    case 1:
    case 2: {
      let tmpl = renderText(t.sourceFmt);
      const a = t.arguments || [];
      for (let i = 0; i < a.length; i++) {
        const val = a[i].type === 4 ? renderText(a[i].value) : String(a[i].value);
        tmpl = tmpl.replaceAll('{' + (a[i].key != null ? a[i].key : i) + '}', val);
      }
      return tmpl;
    }
    case 4: return String(t.sourceValue?.value ?? '');
    default: return `<historyType=${t.historyType}>`;
  }
}
const findP = (props, name) => Array.isArray(props) ? props.find(p => p.tag.name?.value === name) : null;
const shortClass = (p) => !p ? '?' : String(p).split('/').pop().split('.').pop().replace(/_C$/, '');
const elemProps = (elem) => elem?.form === 'propStream' ? elem.stream.properties : null;
function coords(transf) {
  const t = transf?.split('|')[0]?.split(',').map(Number) ?? [];
  return { x: t[0], y: t[1], z: t[2], ok: Number.isFinite(t[0]) };
}

const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT actor_serial, actor_script, actor_transf, actor_data FROM actor_table').all();

// type -> { count, npcs:Set, samples:[{serial,name,date,coords,msg,hist}] }
const workTypes = new Map();
const clanTypes = new Map();
let npcCount = 0, transfSamples = [];

function bucket(map, type, sample) {
  if (!map.has(type)) map.set(type, { count: 0, npcs: new Set(), samples: [] });
  const b = map.get(type);
  b.count++; b.npcs.add(sample.serial); b.samples.push(sample);
}

for (const row of rows) {
  if (!row.actor_data || row.actor_data.byteLength < 8) continue;
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  if (new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true) !== 2) continue;
  let inner; try { inner = _lz4.decompress(u8.subarray(4)); } catch { continue; }
  let blob; try { blob = UnrealBlob.fromBytes(inner); } catch { continue; }

  const log = blob.findPropertyDeep('JingYingRiZhiList');
  if (log?.elements?.length) {
    npcCount++;
    const name = blob.findPropertyDeep('CustomMingZi')?.value?.displayString
              ?? lookupNpc(row.actor_script) ?? shortClass(row.actor_script);
    const c = coords(row.actor_transf);
    if (transfSamples.length < 3) transfSamples.push(row.actor_transf);
    for (const elem of log.elements) {
      const p = elemProps(elem); if (!p) continue;
      const date = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.binaryValue);
      const type = findP(p, 'Type')?.value;
      const parts = findP(p, 'ParamArrayTxt')?.elements ?? [];
      const msg = parts.map(renderText).filter(Boolean).join(' / ') || '(no params)';
      const hist = parts.map(t => t?.historyType).join(',');
      bucket(workTypes, type, { serial: row.actor_serial, name, date, coords: c, msg, hist });
    }
  }

  const ghm = blob.findPropertyDeep('GongHuiMap');
  if (ghm?.entries) {
    const c = coords(row.actor_transf);
    for (const entry of ghm.entries) {
      const cp = elemProps(entry.value); if (!cp) continue;
      const arr = findP(cp, 'ArrayRiZhi'); if (!arr?.elements?.length) continue;
      const clanName = findP(cp, 'Name')?.value ?? `clan ${entry.key}`;
      for (const elem of arr.elements) {
        const p = elemProps(elem); if (!p) continue;
        const date = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.binaryValue);
        const type = findP(p, 'Type')?.value;
        const parts = findP(p, 'ParamArrayTxt')?.elements ?? [];
        const msg = parts.map(renderText).filter(Boolean).join(' / ') || '(no params)';
        const hist = parts.map(t => t?.historyType).join(',');
        bucket(clanTypes, type, { serial: row.actor_serial, name: clanName, date, coords: c, msg, hist });
      }
    }
  }
}

const sortByDateDesc = (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0);
function reps(b, n = 3) {
  // Prefer distinct NPCs, newest first.
  const seen = new Set(), out = [];
  for (const s of [...b.samples].sort(sortByDateDesc)) {
    if (seen.has(s.serial)) continue;
    seen.add(s.serial); out.push(s);
    if (out.length >= n) break;
  }
  while (out.length < n && out.length < b.samples.length) out.push([...b.samples].sort(sortByDateDesc)[out.length]);
  return out;
}

console.log(`\nScanned ${rows.length} actors; ${npcCount} NPCs with work logs. Timezone: ${TZ}.`);
console.log(`Sample actor_transf: ${transfSamples[0]}`);

const allWork = [...workTypes.keys()].sort((a, b) => a - b);
console.log(`\n=== NPC work-log Types present (${allWork.length}) ===`);
for (const t of allWork) {
  const b = workTypes.get(t);
  console.log(`  Type ${String(t).padStart(3)}  ${KNOWN.has(t) ? 'known  ' : 'UNKNOWN'}  ${String(b.count).padStart(6)} entries / ${b.npcs.size} NPCs`);
}

const unknown = allWork.filter(t => !KNOWN.has(t));
console.log(`\n=== UNKNOWN work-log Types: ${unknown.length} (${unknown.join(', ')}) ===`);
for (const t of unknown.sort((a, b) => workTypes.get(b).count - workTypes.get(a).count)) {
  const b = workTypes.get(t);
  console.log(`\n--- Type ${t}  (${b.count} entries across ${b.npcs.size} NPCs) ---`);
  for (const s of reps(b)) {
    const g = s.coords.ok ? `gm Go ${Math.round(s.coords.x)} ${Math.round(s.coords.y)} ${Math.round(s.coords.z)}` : '(no coords)';
    console.log(`  NPC "${s.name}"  (#${s.serial})`);
    console.log(`     when:   ${fmtLocal(s.date)}`);
    console.log(`     where:  ${g}`);
    console.log(`     params: [hist=${s.hist}]  ${s.msg}`);
  }
}

// ── Efficient field plan: fewest NPCs covering all unknown work-log types ────
const npcCov = new Map(); // serial -> { name, coords, types: Map(type -> latest sample) }
for (const t of unknown) {
  for (const s of workTypes.get(t).samples) {
    if (!npcCov.has(s.serial)) npcCov.set(s.serial, { name: s.name, coords: s.coords, types: new Map() });
    const e = npcCov.get(s.serial).types;
    const prev = e.get(t);
    if (!prev || (s.date?.getTime() ?? 0) > (prev.date?.getTime() ?? 0)) e.set(t, s);
  }
}
const need = new Set(unknown);
const chosen = [];
while (need.size) {
  let best = null, bestCov = [];
  for (const [serial, e] of npcCov) {
    const cov = [...e.types.keys()].filter(t => need.has(t));
    if (cov.length > bestCov.length) { best = serial; bestCov = cov; }
  }
  if (!best) break;
  chosen.push({ serial: best, e: npcCov.get(best), cover: bestCov.sort((a, b) => a - b) });
  for (const t of bestCov) need.delete(t);
}
console.log(`\n=== FIELD PLAN: ${chosen.length} NPCs cover all ${unknown.length} unknown work-log types ===`);
for (const c of chosen) {
  const g = c.e.coords.ok ? `gm Go ${Math.round(c.e.coords.x)} ${Math.round(c.e.coords.y)} ${Math.round(c.e.coords.z)}` : '(no coords)';
  console.log(`\n  "${c.e.name}"  (#${c.serial})   covers types: ${c.cover.join(', ')}`);
  console.log(`     ${g}`);
  for (const t of c.cover) {
    const s = c.e.types.get(t);
    console.log(`       Type ${String(t).padStart(2)} @ ${fmtLocal(s.date)}  | [hist=${s.hist}] ${s.msg}`);
  }
}

const allClan = [...clanTypes.keys()].sort((a, b) => a - b);
console.log(`\n=== Clan-log Types present (${allClan.length}: ${allClan.join(', ')}) - none are template-mapped today ===`);
for (const t of allClan.sort((a, b) => clanTypes.get(b).count - clanTypes.get(a).count)) {
  const b = clanTypes.get(t);
  const s = reps(b, 1)[0];
  console.log(`  Type ${String(t).padStart(3)}  ${String(b.count).padStart(5)} entries   e.g. "${s.name}" @ ${fmtLocal(s.date)}  | ${s.msg}`);
}
console.log('');
