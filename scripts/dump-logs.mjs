#!/usr/bin/env node
/**
 * Dump every actor's logs in a world.db to a single, timestamp-sorted .log
 * file.
 *
 *   node scripts/dump-logs.mjs <world.db> [output.log]
 *
 * Three log streams are merged:
 *   WB   workbench / chest / container access log
 *        (RongQiCunQuRiZhiData on JianZhu actors — chests, workbenches, etc.)
 *   NPC  NPC work log
 *        (JingYingRiZhiList on humanoid NPCs)
 *   CLAN guild/clan-wide log
 *        (ArrayRiZhi inside GameMode -> HGongHuiGuanLiQi -> GongHuiMap entries)
 *
 * Each entry's DateTime is read as .NET ticks (100-ns intervals since year 1
 * AD UTC) and rendered as ISO-8601 UTC. NamedFormat / OrderedFormat FText
 * placeholders are substituted into their format strings so the log line is
 * human-readable without needing the game's localization tables.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';

import { UnrealBlob } from '../wscodec.mjs';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = process.argv[2];
const outPath = process.argv[3] || (dbPath ? dbPath.replace(/\.db$/i, '') + '.log' : null);
if (!dbPath || !outPath) {
  console.error('Usage: node scripts/dump-logs.mjs <world.db> [output.log]');
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: database file not found: ${dbPath}`);
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────
// .NET DateTime ticks → JS Date. Ticks count 100-ns intervals from
// 0001-01-01T00:00:00 UTC; subtract the count at the 1970 epoch and convert
// to milliseconds.
const TICKS_AT_UNIX_EPOCH = 621355968000000000n;
function ticksToDate(ticks) {
  if (ticks == null) return null;
  try {
    const bi = typeof ticks === 'bigint' ? ticks : BigInt(ticks);
    const ms = Number((bi - TICKS_AT_UNIX_EPOCH) / 10000n);
    if (!Number.isFinite(ms)) return null;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}
function fmtDate(d) {
  return d ? d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z') : '????-??-?? ??:??:??Z';
}

// Trim a UE class path to its tail: "/Game/.../Foo_C" -> "Foo".
function shortClass(p) {
  if (!p) return '?';
  const last = String(p).split('/').pop().split('.').pop();
  return last.replace(/_C$/, '');
}

// Render an FText for log output, substituting placeholder args into the
// format pattern for NamedFormat (historyType=1) and OrderedFormat (=2).
function renderText(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  switch (t.historyType) {
    case -1: return t.displayString ?? '';
    case 0:  return t.sourceString ?? t.key ?? '';
    case 1:
    case 2: {
      let tmpl = renderText(t.sourceFmt);
      const args = t.arguments || [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        const value = a.type === 4 ? renderText(a.value) : String(a.value);
        const placeholder = a.key != null ? a.key : String(i);
        tmpl = tmpl.replaceAll('{' + placeholder + '}', value);
      }
      return tmpl;
    }
    case 4: return String(t.sourceValue?.value ?? '');
    default: return `<FText historyType=${t.historyType}>`;
  }
}

const findP = (props, name) => Array.isArray(props) ? props.find(p => p.tag.name?.value === name) : null;

// Depth-first walk of the property tree looking for a top-level or nested
// property with the given name.
function findPropDeep(props, target) {
  if (!Array.isArray(props)) return null;
  for (const p of props) {
    if (p.tag.name?.value === target) return p;
    const v = p.value;
    if (Array.isArray(v?.embedded)) {
      const hit = findPropDeep(v.embedded, target);
      if (hit) return hit;
    }
    if (v?._structName && Array.isArray(v.value)) {
      const hit = findPropDeep(v.value, target);
      if (hit) return hit;
    }
  }
  return null;
}

// ── Walk every actor ────────────────────────────────────────────────────────
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT actor_serial, actor_script, actor_data FROM actor_table').all();

const events = [];
const stats = { workbenches: 0, wbEntries: 0, npcs: 0, npcEntries: 0, clans: 0, clanEntries: 0, skipped: 0 };

for (const row of rows) {
  if (!row.actor_data || row.actor_data.byteLength < 8) { stats.skipped++; continue; }
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  if (new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true) !== 2) { stats.skipped++; continue; }
  let inner; try { inner = _lz4.decompress(u8.subarray(4)); } catch { stats.skipped++; continue; }
  let blob; try { blob = UnrealBlob.decode(inner); } catch { stats.skipped++; continue; }
  if (blob.error) { stats.skipped++; continue; }

  // ── Workbench/chest access logs ──────────────────────────────────────────
  const wb = findP(blob.properties, 'RongQiCunQuRiZhiData');
  if (wb?.value?.elements?.length) {
    stats.workbenches++;
    const wbName = findP(blob.properties, 'JianZhuDisplayName')?.value?.displayString
                 ?? shortClass(row.actor_script);
    for (const elem of wb.value.elements) {
      // ArrayProperty<StructProperty> elements are runtime StructValue
      // instances; .value holds the property array (the JSON form would
      // use .properties instead).
      const p = Array.isArray(elem?.value) ? elem.value : null;
      if (!p) continue;
      const dt    = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.value);
      const item  = shortClass(findP(p, 'DaoJuClass')?.value?.path);
      const count = findP(p, 'DaoJuCount')?.value ?? 0;
      const cunqu = String(findP(p, 'CunQuType')?.value?.value ?? '');
      const sign  = cunqu.endsWith('Cun') ? '+' : cunqu.endsWith('Qu') ? '-' : '?';
      const op    = findP(p, 'CaoZuoZheName')?.value?.displayString ?? '?';
      const qual  = String(findP(p, 'DaoJuPinZhi')?.value?.value ?? '');
      const qualStr = (qual && !/Level1$/.test(qual)) ? `  (${qual.replace(/^EDaoJuPinZhi::/, '')})` : '';
      events.push({
        date: dt,
        line: `${fmtDate(dt)}  WB   serial=${String(row.actor_serial).padStart(6)}  ${op.padEnd(20)} ${sign}${String(count).padStart(4)} ${item}${qualStr}  in "${wbName}"`,
      });
      stats.wbEntries++;
    }
  }

  // ── NPC work logs ────────────────────────────────────────────────────────
  const log = findPropDeep(blob.properties, 'JingYingRiZhiList');
  if (log?.value?.elements?.length) {
    stats.npcs++;
    const npcName = findP(blob.properties, 'CustomMingZi')?.value?.displayString
                  ?? findPropDeep(blob.properties, 'CustomMingZi')?.value?.displayString
                  ?? shortClass(row.actor_script);
    for (const elem of log.value.elements) {
      const p = Array.isArray(elem?.value) ? elem.value : null;
      if (!p) continue;
      const dt = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.value);
      const type = findP(p, 'Type')?.value;
      const pat = findP(p, 'ParamArrayTxt');
      const args = (pat?.value?.elements ?? []).map(renderText).filter(Boolean).join(' | ');
      events.push({
        date: dt,
        line: `${fmtDate(dt)}  NPC  serial=${String(row.actor_serial).padStart(6)}  ${(`"${npcName}"`).padEnd(28)} type=${String(type).padStart(2)}  ${args}`,
      });
      stats.npcEntries++;
    }
  }

  // ── Clan logs (GameMode > HGongHuiGuanLiQi > GongHuiMap{*} > value.ArrayRiZhi) ─
  // GongHuiMap is Map<Guid, StructValue>; each StructValue's nested property
  // stream is at .value.value (the StructValue instance holds the property
  // array in `value`; the JSON form uses `properties` instead).
  const ghm = findPropDeep(blob.properties, 'GongHuiMap');
  if (ghm?.value?.entries) {
    for (const entry of ghm.value.entries) {
      const clanProps = Array.isArray(entry.value?.value) ? entry.value.value : null;
      if (!clanProps) continue;
      const arr = findP(clanProps, 'ArrayRiZhi');
      if (!arr?.value?.elements?.length) continue;
      stats.clans++;
      const clanName = findP(clanProps, 'GongHuiName')?.value
                    ?? `clan ${entry.key}`;
      for (const elem of arr.value.elements) {
        // arr is ArrayProperty<StructProperty>; each element is a StructValue
        // whose .value is the property array.
        const p = Array.isArray(elem?.value) ? elem.value : null;
        if (!p) continue;
        const dt = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.value);
        const type = findP(p, 'Type')?.value;
        const pat = findP(p, 'ParamArrayTxt');
        const args = (pat?.value?.elements ?? []).map(renderText).filter(Boolean).join(' | ');
        events.push({
          date: dt,
          line: `${fmtDate(dt)}  CLAN serial=${String(row.actor_serial).padStart(6)}  ${(`"${clanName}"`).padEnd(28)} type=${String(type).padStart(2)}  ${args}`,
        });
        stats.clanEntries++;
      }
    }
  }
}

events.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

const header = [
  `# wscodec actor log dump`,
  `# source:    ${dbPath}`,
  `# generated: ${new Date().toISOString()}`,
  `# events:    ${events.length}`,
  `#   WB   ${stats.wbEntries} entries from ${stats.workbenches} workbenches/chests`,
  `#   NPC  ${stats.npcEntries} entries from ${stats.npcs} NPCs`,
  `#   CLAN ${stats.clanEntries} entries from ${stats.clans} clans`,
  `# skipped: ${stats.skipped} non-decodable rows`,
  `#`,
  `# columns: <UTC timestamp>  <kind>  serial=<actor_serial>  <fields>`,
  `# WB:   <operator> <sign><count> <item>[ <quality>] in "<workbench-name>"`,
  `#       sign is + for deposit (Cun) or - for withdraw (Qu)`,
  `# NPC:  "<npc-name>" type=<TypeId>  <ParamArrayTxt rendered with format-args substituted>`,
  `# CLAN: "<clan-name>" type=<TypeId>  <ParamArrayTxt rendered>`,
  ``,
].join('\n');

fs.writeFileSync(outPath, header + events.map(e => e.line).join('\n') + '\n');

console.log(`wrote ${events.length} log lines to ${outPath}`);
console.log(`  WB  : ${stats.wbEntries} entries / ${stats.workbenches} workbenches`);
console.log(`  NPC : ${stats.npcEntries} entries / ${stats.npcs} NPCs`);
console.log(`  CLAN: ${stats.clanEntries} entries / ${stats.clans} clans`);
