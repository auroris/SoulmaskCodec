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
import { item as lookupItem, building as lookupBuilding, npc as lookupNpc, tables as enNames } from '../src/translations.en.mjs';
import { tables as zhNames } from '../src/translations.zh.mjs';

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
  const dn = blob.findProperty('JianZhuDisplayName')?.value?.displayString;
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
// in-game work-log panel against the ParamArrayTxt placeholders: {0}, {1}, ...
// are ParamArrayTxt elements by position. Most observed Types are mapped and
// verified against the in-game English panel; any unmapped Type falls back to a
// raw placeholder render. The per-type punctuation is reproduced verbatim from
// the game (it is genuinely inconsistent between types). These are
// English-locale templates (Soulmask localizes the work log per language).
const WORK_LOG_TEMPLATES = {
  0:  '{0} work started',
  1:  '{0} work paused',
  4:  'Withdraw {1} from <{0}>.',
  5:  'Go collect in <{0}>({1}).',
  6:  'Go collect resources in <{0}>.',
  7:  'Go to <{0}> and manage nearby fields.',
  9:  'Attend to the Crafting Table in <{0}>.',
  11: 'Place {1} in <{0}> to stop (reason: {2})',
  12: 'Withdraw {1} from <{0}> to stop (reason: {2})',
  13: 'Stops collecting at <{0}> {1} (reason: {3}.).',
  14: 'Collect resources at <{0}> to stop (reason: {1}.).',
  15: 'Manage surrounding farmlands at <{0}> to stop (reason: {1}).',
  16: 'Stop attending to the Crafting Table (reason: {1}.)',
  22: 'Maintain the camp in <{0}>.',
  23: 'Maintain the camp at <{0}> to stop (reason: {1}).',
  25: 'Go to <{0}> and manage nearby pens.',
  26: 'Manage and stop the pens around <{0}> (reason: {1}.).',
  29: 'Sort items at <{0}>',
  30: 'Stopped sorting items at <{0}> (reason: {1}.)',
  33: 'Go to <{0}> to collect loot',
  34: 'Stopped collecting loot at <{0}> (Reason: {1}.)',
};

// Clan-log `Type` -> English template (GameMode GongHuiMap > ArrayRiZhi). Same
// {N} placeholder convention and verify-against-the-game discipline as the work
// log above. The subject param renders as "Name ( Account )" / "Name < Account >"
// from the FText format itself; enemy / unit-archetype names that embed rarity
// or tier modifiers (Elite, Leader, tribe prefixes) may stay zh - they are
// composed at display time, not single table entries. Types 28/29 also carry
// optional attacker-account and damage-source params (a GameplayEffect class
// the game shows as e.g. [Sandstorm] / [#Soulmask]); only the common
// creature-attacker form is templated. All 23 Types observed in this save are
// mapped and verified in-game; any unseen Type falls back to a raw param join.
const CLAN_LOG_TEMPLATES = {
  14: '{0} is killed by {1} , {2}.',
  15: '{0} successfully recruited a tribesman {1}.',
  17: '{0} dismantled building "{1}".',
  19: 'The building {0} has been destroyed from decay.',
  20: '{0} respawned.',
  28: '{0} is severely injured by {1} , {2} and near-death.',
  29: '{0} is severely injured and died.',
  30: '{0} is severely injured from falling and enters the near-death state.',
  31: '{0} died from falling.',
  32: '{0} gets overtired and enters the near-death state.',
  33: '{0} died of overwork.',
  36: '{0} assigned {1} to {2}.',
  37: '{0} dismissed tribesman {1}.',
  38: '{0} started to remodel {1}.',
  39: '{0} remodeled.',
  46: '{0} obtained {1} through continuous self-improvement.',
  47: '{0} removed {1} through continuous adjustment.',
  48: '{0} (located in {1}, {2}, {3}) is being attacked by barbarian tribes, go help them!',
  52: 'Through relentless weapon practice, "{0}" learned new mastery skill "{1}"',
  62: '{0} put the animal(s) in {1}',
  63: '{0} removed the animal(s) from {1}',
  68: 'After relentless training, tribesman {0} raised the proficiency cap of [{1}] to Lv.{2}!',
  78: '{0} dismantled ship {1}',
};

// Soulmask localizes work-log name params (historyType-0 FTexts) by FText key;
// wscodec extracts only their zh `sourceString` (the game's native culture).
// The per-language translation tables ARE the game's own loc export, and the
// zh/en tables share keys - so a zh-value -> en-value bridge resolves every
// name they cover (buildings, stations, item categories, ...) for free.
const NAME_ZH_EN = (() => {
  const map = {};
  for (const cat of Object.keys(enNames)) {
    const en = enNames[cat], zh = zhNames[cat];
    if (!en || !zh) continue;
    for (const key of Object.keys(en)) {
      const zhVal = zh[key], enVal = en[key];
      if (zhVal && enVal && !(zhVal in map)) map[zhVal] = enVal;
    }
  }
  return map;
})();

// Task-state reason strings live in FText namespace "WS" (keys RenWuState_*),
// which the game-data export does NOT include - so these stay hand-mapped,
// keyed by zh source text and verified against the in-game English panel.
const REASONS = {
  '无目标':   'No target',
  '缺材料':   'Need material',
  '缺种子':   'Need seed',
  '空间不足': 'Insufficient space',
  '目标太远': 'The target is too far.',
};

// zh source string -> English: prefer the data-export name tables, then the
// hand-mapped reasons, else pass through (player-typed names are culture-
// invariant and already display-ready).
const localizeParam = (s) => NAME_ZH_EN[s] ?? REASONS[s] ?? s;

// Render one log entry's message: localize each ParamArrayTxt element, then
// substitute into the Type's template when known, else join the raw params.
// Shared by the NPC work log and the clan log (each passes its template map).
function renderLogMessage(templates, type, paramElements) {
  const params = (paramElements ?? []).map(t => localizeParam(renderText(t)));
  const tmpl = templates[type];
  if (tmpl) return tmpl.replace(/\{(\d+)\}/g, (_, i) => params[Number(i)] ?? '');
  return params.filter(Boolean).join(' / ') || '(no detail)';
}

const findP = (props, name) => Array.isArray(props) ? props.find(p => p.tag.name?.value === name) : null;

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
  try { blob = UnrealBlob.fromBytes(inner); }
  catch (e) {
    stats.decodeError++;
    if (stats.decodeErrorExamples.length < 5) stats.decodeErrorExamples.push(`serial=${row.actor_serial}: decode ${e.message}`);
    continue;
  }

  // Pull the propStream property list out of a StructValue array element.
  // Soulmask log arrays use Array<Struct> shape; each element is a
  // StructValue carrying a nested property stream.
  const elemProps = (elem) => elem?.form === 'propStream' ? elem.stream.properties : null;

  // ── Workbench/chest access logs ──────────────────────────────────────────
  const wb = findP(blob.properties, 'RongQiCunQuRiZhiData');
  if (wb?.elements?.length) {
    stats.containers++;
    const name = containerName(blob, row.actor_script);
    for (const elem of wb.elements) {
      const p = elemProps(elem);
      if (!p) continue;
      const dt    = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.binaryValue);
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
            + `   ·  container "${name}" (#${row.actor_serial})`,
      });
      stats.containerEntries++;
    }
  }

  // ── NPC work logs ────────────────────────────────────────────────────────
  const log = blob.findPropertyDeep('JingYingRiZhiList');
  if (log?.elements?.length) {
    stats.npcs++;
    const npcName = blob.findPropertyDeep('CustomMingZi')?.value?.displayString
                  ?? lookupNpc(row.actor_script)
                  ?? shortClass(row.actor_script);
    for (const elem of log.elements) {
      const p = elemProps(elem);
      if (!p) continue;
      const dt = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.binaryValue);
      const type = findP(p, 'Type')?.value;
      const pat = findP(p, 'ParamArrayTxt');
      const msg = renderLogMessage(WORK_LOG_TEMPLATES, type, pat?.elements);
      events.push({
        date: dt,
        line: `${fmtGameTime(dt)}   ${msg}`
            + `   ·  NPC "${npcName}" (#${row.actor_serial}, work-log type ${type})`,
      });
      stats.npcEntries++;
    }
  }

  // ── Clan logs (GameMode > HGongHuiGuanLiQi > GongHuiMap{*} > value.ArrayRiZhi) ─
  const ghm = blob.findPropertyDeep('GongHuiMap');
  if (ghm?.entries) {
    for (const entry of ghm.entries) {
      const clanProps = elemProps(entry.value);
      if (!clanProps) continue;
      const arr = findP(clanProps, 'ArrayRiZhi');
      if (!arr?.elements?.length) continue;
      stats.clans++;
      // The clan struct stores its display name in a plain `Name` StrProperty.
      const clanName = findP(clanProps, 'Name')?.value ?? `clan ${entry.key}`;
      for (const elem of arr.elements) {
        const p = elemProps(elem);
        if (!p) continue;
        const dt = ticksToDate(findP(p, 'RiZhiDateTime')?.value?.binaryValue);
        const type = findP(p, 'Type')?.value;
        const pat = findP(p, 'ParamArrayTxt');
        const msg = renderLogMessage(CLAN_LOG_TEMPLATES, type, pat?.elements);
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
