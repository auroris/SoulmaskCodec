#!/usr/bin/env node
/**
 * Dump every actor's logs in a world.db to a single, timestamp-sorted .log
 * file, formatted close to how Soulmask renders them in-game.
 *
 *   node scripts/dump-logs.mjs <world.db> [output.log]
 *
 * Three log streams are merged:
 *   - workbench / chest / container access logs
 *     (RongQiCunQuRiZhiData on JianZhu actors)
 *   - NPC work logs
 *     (JingYingRiZhiList on humanoid NPCs)
 *   - clan logs
 *     (ArrayRiZhi inside GameMode -> HGongHuiGuanLiQi -> GongHuiMap entries)
 *
 * Timestamps are .NET ticks (100-ns intervals since year 1 AD, UTC), rendered
 * in the machine's local time zone to match the in-game clock. Every line has
 * the same shape:
 *
 *   <timestamp>   <event>   ·  <kind> "<source name>" (#<actor_serial> ...)
 *
 * and every name a line introduces (operator, container, NPC, clan) is quoted.
 *
 * Rows that aren't wscodec property streams (GAME_SETTINGS and similar
 * non-actor records) are reported separately from genuine decode errors — a
 * non-zero decode-error count is the signal that the codec has a real gap.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';

import { UnrealBlob } from '../src/wscodec.mjs';
import { item as lookupItem, building as lookupBuilding, npc as lookupNpc } from '../src/translations.mjs';

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
// 0001-01-01T00:00:00 UTC; subtract the count at the 1970 epoch.
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

// Render game-style: "May 18, 2026, 11:27:19 PM" in the machine's local zone.
// Date and time are formatted separately and joined with a comma — a single
// toLocaleString call on modern Node inserts " at " between them instead.
function fmtGameTime(d) {
  if (!d) return '(unknown time)';
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

// Trim a UE class path to its tail: "/Game/.../Foo_C" -> "Foo".
function shortClass(p) {
  if (!p) return '?';
  return String(p).split('/').pop().split('.').pop().replace(/_C$/, '');
}

// Item class -> English name via the translation tables. Items the tables
// don't cover fall back to the short class with the "DaoJu_Item_" prefix
// (DaoJu == "item") stripped as noise.
function itemName(classPath) {
  const known = lookupItem(classPath);
  if (known) return known;
  return shortClass(classPath).replace(/^DaoJu_?Item_?/i, '').replace(/^Daoju_?Item_?/i, '') || shortClass(classPath);
}

// Container display name: the player-set name if any, else the building's
// translated name, else the cleaned class.
function containerName(blob, actorScript) {
  const dn = blob.properties.find(p => p.tag.name?.value === 'JianZhuDisplayName')?.value?.displayString;
  if (dn) return dn;
  return lookupBuilding(actorScript) ?? shortClass(actorScript).replace(/^BP_/, '');
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

// NPC work-log `Type` -> English template. Derived by cross-referencing the
// in-game work-log panel against the ParamArrayTxt placeholders: {0}, {1} are
// ParamArrayTxt elements by position. PARTIAL — only the Types observed so far
// are mapped; unmapped Types fall back to a raw placeholder render. These are
// English-locale templates (Soulmask localizes the work log per language).
const WORK_LOG_TEMPLATES = {
  0:  '{0} work started',
  1:  '{0} work paused',
  9:  'Attend to the Crafting Table in <{0}>.',
  16: 'Stop attending to the Crafting Table (reason: {1}.)',
  22: 'Maintain the camp in <{0}>.',
  23: 'Maintain the camp at <{0}> to stop (reason: {1}).',
  25: 'Go to <{0}> and manage nearby pens.',
  26: 'Manage and stop the pens around <{0}> (reason: {1}.).',
  33: 'Go to <{0}> to collect loot',
  34: 'Stopped collecting loot at <{0}> (Reason: {1}.)',
};

// Localized strings the game resolves from FText keys we don't have tables
// for. Hand-built and partial; keyed by the Chinese sourceString wscodec
// extracts. Unmapped strings render as-is (Chinese).
const LOC_STRINGS = {
  '黑铁基座营火': 'Iron Pit Bonfire',
  '养殖场':       'Breeding Farm',
  '织布机':       'Loom',
  '厕所':         'Outhouse',
  '无目标':       'No target',
  '缺材料':       'Need material',
};

// Render one log entry's message: substitute ParamArrayTxt elements into the
// Type's template when known, else join the raw rendered params.
function renderWorkLogMessage(type, paramElements) {
  const params = (paramElements ?? []).map(t => {
    const s = renderText(t);
    return LOC_STRINGS[s] ?? s;
  });
  const tmpl = WORK_LOG_TEMPLATES[type];
  if (tmpl) return tmpl.replace(/\{(\d+)\}/g, (_, i) => params[Number(i)] ?? '');
  return params.filter(Boolean).join(' / ') || '(no detail)';
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
const stats = {
  containers: 0, containerEntries: 0,
  npcs: 0, npcEntries: 0,
  clans: 0, clanEntries: 0,
  // A row that simply isn't a wscodec property stream (no actor_data, wrong
  // version tag — e.g. the GAME_SETTINGS row, which stores a JSON FString).
  // Benign and expected.
  notPropertyStream: 0,
  // A row that DID look like a property stream (version tag 0x02) but failed
  // LZ4 decompression or codec decode. A non-zero count here is a real signal
  // that the codec is missing something.
  decodeError: 0,
  decodeErrorExamples: [],
};

for (const row of rows) {
  if (!row.actor_data || row.actor_data.byteLength < 8) { stats.notPropertyStream++; continue; }
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  if (new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true) !== 2) {
    stats.notPropertyStream++;
    continue;
  }
  let inner;
  try { inner = _lz4.decompress(u8.subarray(4)); }
  catch (e) {
    stats.decodeError++;
    if (stats.decodeErrorExamples.length < 5) stats.decodeErrorExamples.push(`serial=${row.actor_serial}: lz4 ${e.message}`);
    continue;
  }
  let blob;
  try { blob = UnrealBlob.decode(inner); }
  catch (e) {
    stats.decodeError++;
    if (stats.decodeErrorExamples.length < 5) stats.decodeErrorExamples.push(`serial=${row.actor_serial}: decode ${e.message}`);
    continue;
  }
  if (blob.error) {
    stats.decodeError++;
    if (stats.decodeErrorExamples.length < 5) stats.decodeErrorExamples.push(`serial=${row.actor_serial}: ${blob.error}`);
    continue;
  }

  // ── Workbench/chest access logs ──────────────────────────────────────────
  const wb = findP(blob.properties, 'RongQiCunQuRiZhiData');
  if (wb?.value?.elements?.length) {
    stats.containers++;
    const name = containerName(blob, row.actor_script);
    for (const elem of wb.value.elements) {
      const p = Array.isArray(elem?.value) ? elem.value : null;
      if (!p) continue;
      const dt    = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.value);
      const item  = itemName(findP(p, 'DaoJuClass')?.value?.path);
      const count = findP(p, 'DaoJuCount')?.value ?? 0;
      const cunqu = String(findP(p, 'CunQuType')?.value?.value ?? '');
      const verb  = cunqu.endsWith('Cun') ? 'deposited'
                  : cunqu.endsWith('Qu')  ? 'withdrew'
                  : 'moved';
      const op    = findP(p, 'CaoZuoZheName')?.value?.displayString || '(unknown)';
      const qual  = String(findP(p, 'DaoJuPinZhi')?.value?.value ?? '').replace(/^EDaoJuPinZhi::EDJPZ_/, '');
      const qualStr = (qual && qual !== 'Level1') ? `[${qual}] ` : '';
      events.push({
        date: dt,
        line: `${fmtGameTime(dt)}   "${op}" ${verb} ${qualStr}${item} x${count}`
            + `   ·  chest "${name}" (#${row.actor_serial})`,
      });
      stats.containerEntries++;
    }
  }

  // ── NPC work logs ────────────────────────────────────────────────────────
  const log = findPropDeep(blob.properties, 'JingYingRiZhiList');
  if (log?.value?.elements?.length) {
    stats.npcs++;
    const npcName = findP(blob.properties, 'CustomMingZi')?.value?.displayString
                  ?? findPropDeep(blob.properties, 'CustomMingZi')?.value?.displayString
                  ?? lookupNpc(row.actor_script)
                  ?? shortClass(row.actor_script);
    for (const elem of log.value.elements) {
      const p = Array.isArray(elem?.value) ? elem.value : null;
      if (!p) continue;
      const dt = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.value);
      const type = findP(p, 'Type')?.value;
      const pat = findP(p, 'ParamArrayTxt');
      const msg = renderWorkLogMessage(type, pat?.value?.elements);
      events.push({
        date: dt,
        line: `${fmtGameTime(dt)}   ${msg}`
            + `   ·  NPC "${npcName}" (#${row.actor_serial}, work-log type ${type})`,
      });
      stats.npcEntries++;
    }
  }

  // ── Clan logs (GameMode > HGongHuiGuanLiQi > GongHuiMap{*} > value.ArrayRiZhi) ─
  const ghm = findPropDeep(blob.properties, 'GongHuiMap');
  if (ghm?.value?.entries) {
    for (const entry of ghm.value.entries) {
      const clanProps = Array.isArray(entry.value?.value) ? entry.value.value : null;
      if (!clanProps) continue;
      const arr = findP(clanProps, 'ArrayRiZhi');
      if (!arr?.value?.elements?.length) continue;
      stats.clans++;
      // The clan struct stores its display name in a plain `Name` StrProperty.
      const clanName = findP(clanProps, 'Name')?.value ?? `clan ${entry.key}`;
      for (const elem of arr.value.elements) {
        const p = Array.isArray(elem?.value) ? elem.value : null;
        if (!p) continue;
        const dt = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.value);
        const type = findP(p, 'Type')?.value;
        const pat = findP(p, 'ParamArrayTxt');
        const msg = (pat?.value?.elements ?? []).map(renderText).filter(Boolean).join(' / ') || '(no detail)';
        events.push({
          date: dt,
          line: `${fmtGameTime(dt)}   ${msg}`
              + `   ·  clan "${clanName}" (#${row.actor_serial}, log type ${type})`,
        });
        stats.clanEntries++;
      }
    }
  }
}

events.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

// ── Header ──────────────────────────────────────────────────────────────────
const n = (x) => x.toLocaleString('en-US');
const header = [
  `# Soulmask actor log dump (wscodec)`,
  `# source:     ${dbPath}`,
  `# generated:  ${new Date().toISOString()}`,
  `# timestamps: machine local time zone (matches the in-game clock)`,
  `#`,
  `# ${n(events.length)} entries, oldest first:`,
  `#   ${String(n(stats.containerEntries)).padStart(8)}  workbench / chest access  (${stats.containers} containers)`,
  `#   ${String(n(stats.npcEntries)).padStart(8)}  NPC work log               (${stats.npcs} NPCs)`,
  `#   ${String(n(stats.clanEntries)).padStart(8)}  clan log                   (${stats.clans} clans)`,
  `#`,
  `# ${stats.notPropertyStream} row(s) skipped: not a wscodec property stream — non-actor records`,
  `#   such as GAME_SETTINGS (a JSON-string blob). Expected; nothing is lost.`,
  stats.decodeError === 0
    ? `# ${stats.decodeError} row(s) skipped: decode errors. (A non-zero count here would mean a codec gap.)`
    : `# !! ${stats.decodeError} row(s) FAILED TO DECODE — this indicates a codec gap, investigate:`,
  ...stats.decodeErrorExamples.map(e => `#    ${e}`),
  `#`,
].join('\n');

fs.writeFileSync(outPath, header + '\n' + events.map(e => e.line).join('\n') + '\n');

console.log(`wrote ${events.length} log lines to ${outPath}`);
console.log(`  workbench/chest: ${stats.containerEntries} entries / ${stats.containers} containers`);
console.log(`  NPC work log:    ${stats.npcEntries} entries / ${stats.npcs} NPCs`);
console.log(`  clan log:        ${stats.clanEntries} entries / ${stats.clans} clans`);
console.log(`  not a property stream: ${stats.notPropertyStream} (benign)`);
console.log(`  decode errors:         ${stats.decodeError}${stats.decodeError ? '  <-- codec gap, investigate' : ''}`);
