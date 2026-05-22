#!/usr/bin/env node
/**
 * Survey NPC work logs and find the one with the most diverse set of log
 * `Type` codes, then print its most-recent entry for each distinct Type.
 *
 *   node scripts/npc-log-survey.mjs <world.db> [--tz-offset -6]
 *
 * Used to cross-reference Soulmask's log `Type` enum against the localized
 * text the game renders: pick the NPC this prints, read its work log in-game,
 * and match each timestamp to what the game shows.
 *
 * Timestamps are printed at a fixed UTC offset (default -6, Mountain Daylight
 * Time) so they line up with the in-game clock regardless of where the script
 * runs.
 */

import { createRequire } from 'node:module';
import { UnrealBlob } from '../src/wscodec.mjs';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const args = process.argv.slice(2);
const dbPath = args[0];
const tzIdx = args.indexOf('--tz-offset');
const tzOffsetHours = tzIdx >= 0 ? Number(args[tzIdx + 1]) : -6;
if (!dbPath) {
  console.error('Usage: node scripts/npc-log-survey.mjs <world.db> [--tz-offset -6]');
  process.exit(1);
}

const TICKS_AT_UNIX_EPOCH = 621355968000000000n;
function ticksToDate(ticks) {
  if (ticks == null) return null;
  try {
    const ms = Number((BigInt(ticks) - TICKS_AT_UNIX_EPOCH) / 10000n);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}
function fmtTz(d) {
  if (!d) return '(unknown time)';
  const shifted = new Date(d.getTime() + tzOffsetHours * 3600 * 1000);
  const o = { timeZone: 'UTC' };
  const date = shifted.toLocaleDateString('en-US', { ...o, month: 'long', day: 'numeric', year: 'numeric' });
  const time = shifted.toLocaleTimeString('en-US', { ...o, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  const sign = tzOffsetHours <= 0 ? '' : '+';
  return `${date}, ${time}  (UTC${sign}${tzOffsetHours})`;
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
function findPropDeep(props, target) {
  if (!Array.isArray(props)) return null;
  for (const p of props) {
    if (p.tag.name?.value === target) return p;
    const v = p.value;
    if (Array.isArray(v?.embedded)) { const h = findPropDeep(v.embedded, target); if (h) return h; }
    if (v?._structName && Array.isArray(v.value)) { const h = findPropDeep(v.value, target); if (h) return h; }
  }
  return null;
}

const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT actor_serial, actor_script, actor_transf, actor_data FROM actor_table').all();

const npcs = [];
for (const row of rows) {
  if (!row.actor_data || row.actor_data.byteLength < 8) continue;
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  if (new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true) !== 2) continue;
  let inner; try { inner = _lz4.decompress(u8.subarray(4)); } catch { continue; }
  let blob; try { blob = UnrealBlob.decode(inner); } catch { continue; }
  if (blob.error) continue;

  const log = findPropDeep(blob.properties, 'JingYingRiZhiList');
  if (!log?.value?.elements?.length) continue;

  const name = findP(blob.properties, 'CustomMingZi')?.value?.displayString
            ?? findPropDeep(blob.properties, 'CustomMingZi')?.value?.displayString
            ?? `(unnamed ${row.actor_serial})`;

  const entries = [];
  for (const elem of log.value.elements) {
    const p = Array.isArray(elem?.value) ? elem.value : null;
    if (!p) continue;
    const date = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.value);
    const type = findP(p, 'Type')?.value;
    const pat = findP(p, 'ParamArrayTxt');
    const parts = (pat?.value?.elements ?? []);
    const msg = parts.map(renderText).filter(Boolean).join(' / ') || '(no params)';
    const histTypes = parts.map(t => t?.historyType).join(',');
    entries.push({ date, type, msg, histTypes });
  }
  const distinctTypes = new Set(entries.map(e => e.type));
  npcs.push({
    serial: row.actor_serial,
    name,
    transf: row.actor_transf,
    entries,
    distinctTypeCount: distinctTypes.size,
    entryCount: entries.length,
  });
}

// Rank by distinct Type count, then by entry count.
npcs.sort((a, b) => b.distinctTypeCount - a.distinctTypeCount || b.entryCount - a.entryCount);

console.log(`Surveyed ${npcs.length} NPCs with work logs.`);
console.log('Top 5 by log-Type diversity:');
for (const n of npcs.slice(0, 5)) {
  console.log(`  #${n.serial}  "${n.name}"  — ${n.distinctTypeCount} distinct types, ${n.entryCount} entries`);
}
console.log('');

const pick = npcs[0];
if (!pick) { console.log('no NPCs with logs found'); process.exit(0); }

const trans = pick.transf?.split('|')[0]?.split(',').map(Number) ?? [];
console.log('═══════════════════════════════════════════════════════════════');
console.log(`SELECTED: "${pick.name}"   (actor_serial ${pick.serial})`);
console.log(`Coordinates: X=${trans[0]?.toFixed(1)}  Y=${trans[1]?.toFixed(1)}  Z=${trans[2]?.toFixed(1)}`);
console.log(`Work log: ${pick.entryCount} entries spanning ${pick.distinctTypeCount} distinct Type codes`);
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Most recent entry for each distinct Type (newest first):');
console.log('');

// For each distinct Type, take the most-recent entry.
const byType = new Map();
for (const e of pick.entries) {
  const prev = byType.get(e.type);
  if (!prev || (e.date?.getTime() ?? 0) > (prev.date?.getTime() ?? 0)) byType.set(e.type, e);
}
const recentPerType = [...byType.values()].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
for (const e of recentPerType) {
  console.log(`Type ${String(e.type).padStart(3)}   ${fmtTz(e.date)}`);
  console.log(`           historyTypes=[${e.histTypes}]  rendered: ${e.msg}`);
  console.log('');
}
