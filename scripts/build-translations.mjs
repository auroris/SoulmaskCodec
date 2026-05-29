#!/usr/bin/env node
/**
 * Generate src/translations.data.<lang>.mjs from the game-data CSV export in ext/.
 *
 *   npm run build-translations
 *
 * ext/ is the raw export (gitignored, ~420 MB). It holds one subdirectory per
 * language - ext/en/, ext/de/, ... - each a full CSV export whose key columns
 * (class, id, ...) are identical and whose name/desc columns are translated.
 * One compact data module is emitted per language; those are committed and
 * shipped, so a normal install/build never needs ext/. Re-run this after a
 * game patch refreshes ext/.
 *
 * Only display-name text is extracted: no descriptions, icons, or stats.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'ext');
const SRC = path.join(ROOT, 'src');

if (!fs.existsSync(EXT)) {
  console.error(`ext/ not found at ${EXT}`);
  console.error('Drop the game-data CSV export there, then re-run.');
  process.exit(1);
}

// Languages are the ext/ subdirectories that carry a full export (Item.csv is
// present in every language), so adding/removing a language needs no edit here.
const LANGS = fs.readdirSync(EXT, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(EXT, d.name, 'Item', 'Item.csv')))
  .map(d => d.name)
  .sort();

if (!LANGS.length) {
  console.error(`no language exports found under ${EXT} (expected ext/<lang>/Item/Item.csv)`);
  process.exit(1);
}

// ── minimal RFC 4180 CSV parser ─────────────────────────────────────────────
// Handles quoted fields, "" escapes, embedded commas/newlines, CRLF line ends,
// and a leading UTF-8 BOM. Returns an array of string[] rows.
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = ''; rows.push(row); row = [];
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Parse an ext/<lang>/ CSV into objects keyed by trimmed header name.
function readTable(lang, relPath) {
  const rows = parseCsv(fs.readFileSync(path.join(EXT, lang, relPath), 'utf8'));
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.length > 1 || r[0] !== '')
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// "/Game/.../BP_X.BP_X_C", "BP_X_C", or "BP_X" -> "BP_X" (matches dump-logs).
function shortClass(p) {
  return String(p).split('/').pop().split('.').pop().replace(/_C$/, '');
}

// Relative paths of every *.csv in an ext/<lang>/ subdir.
function csvsIn(lang, dir) {
  return fs.readdirSync(path.join(EXT, lang, dir))
    .filter(f => f.toLowerCase().endsWith('.csv'))
    .map(f => `${dir}/${f}`);
}

// ── extraction sources ──────────────────────────────────────────────────────
// keyKind 'class' normalizes the key via shortClass; 'raw' keeps it verbatim.
// `files` is either a static list of language-relative paths or a function of
// the language code (for directories whose CSV set is discovered at runtime).
const SOURCES = [
  { cat: 'items',         files: ['Item/Item.csv'],              keyCols: ['class'], nameCol: 'name', keyKind: 'class' },
  { cat: 'npcs',          files: (lang) => csvsIn(lang, 'Npc'),  keyCols: ['class'], nameCol: 'name', keyKind: 'class' },
  { cat: 'buildings',     files: ['Recipe/Workbenches.csv', 'Building/Building.csv'], keyCols: ['class'], nameCol: 'name', keyKind: 'class' },
  { cat: 'recipes',       files: (lang) => csvsIn(lang, 'Recipe').filter(f => !/Workbenches\.csv$/.test(f)), keyCols: ['id'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'proficiencies', files: ['Proficiency/Proficiency.csv'], keyCols: ['id'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'mastery',       files: ['Mastery/Mastery.csv'],        keyCols: ['id'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'attributes',    files: ['Attribute/Attribute.csv'],    keyCols: ['class'], nameCol: 'desc', keyKind: 'raw' },
  { cat: 'fashion',       files: ['Fashion/Fashion.csv'],        keyCols: ['id_m', 'id_f'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'tattoos',       files: ['WenShen/WenShen.csv'],        keyCols: ['head_m', 'head_f', 'chest_m', 'chest_f', 'arm_m', 'arm_f', 'leg_m', 'leg_f'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'gifts',         files: (lang) => csvsIn(lang, 'Gift'), keyCols: ['Level 1', 'Level 2', 'Level 3'], nameCol: 'Title', keyKind: 'raw' },
  { cat: 'settings',      files: ['XiShu/XiShu_0.csv', 'XiShu/XiShu_1.csv', 'XiShu/XiShu_2.csv'], keyCols: ['name'], nameCol: 'desc', keyKind: 'raw' },
  // Activity-log format strings, keyed by enum value (worklog/clanlog) or task-state
  // member name (reasons). Used by scripts/dump-logs.mjs to render save-game logs.
  { cat: 'worklog',       files: ['Log/WorkLog.csv'],            keyCols: ['id'],   nameCol: 'name', keyKind: 'raw' },
  { cat: 'clanlog',       files: ['Log/ClanLog.csv'],            keyCols: ['id'],   nameCol: 'name', keyKind: 'raw' },
  { cat: 'reasons',       files: ['Log/Reason.csv'],             keyCols: ['key'],  nameCol: 'name', keyKind: 'raw' },
];

// Build the full name-table object for one language.
function buildTables(lang) {
  const out = {};
  let collisions = 0;

  for (const src of SOURCES) {
    const map = {};
    const files = typeof src.files === 'function' ? src.files(lang) : src.files;
    for (const file of files) {
      let table;
      try { table = readTable(lang, file); }
      catch (e) { console.warn(`  skipped ${lang}/${file}: ${e.message}`); continue; }
      for (const row of table) {
        const name = (row[src.nameCol] ?? '').trim();
        if (!name) continue;
        for (const kc of src.keyCols) {
          let key = (row[kc] ?? '').trim();
          if (!key) continue;
          if (src.keyKind === 'class') key = shortClass(key);
          if (key in map) { if (map[key] !== name) collisions++; }
          else map[key] = name;
        }
      }
    }
    out[src.cat] = map;
  }

  // Item-category id -> name, from Item.csv's cat / cat_name columns.
  const cats = {};
  for (const row of readTable(lang, 'Item/Item.csv')) {
    const id = (row.cat ?? '').trim(), nm = (row.cat_name ?? '').trim();
    if (id && nm && !(id in cats)) cats[id] = nm;
  }
  out.categories = cats;

  return { out, collisions };
}

// ── emit ────────────────────────────────────────────────────────────────────
// Keys are sorted so regeneration produces a stable, reviewable diff.
function emit(lang, out) {
  const banner =
    `// GENERATED by scripts/build-translations.mjs - do not edit by hand.\n` +
    `// Soulmask game-data name tables (${lang}); regenerate after a game patch.\n\n`;
  const body = Object.entries(out).map(([cat, map]) => {
    const lines = Object.keys(map).sort()
      .map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])},`);
    return `export const ${cat} = {\n${lines.join('\n')}\n};\n`;
  }).join('\n');
  const file = path.join(SRC, `translations.data.${lang}.mjs`);
  fs.writeFileSync(file, banner + body);
  return file;
}

let grand = 0;
for (const lang of LANGS) {
  const { out, collisions } = buildTables(lang);
  const file = emit(lang, out);
  const total = Object.values(out).reduce((s, m) => s + Object.keys(m).length, 0);
  grand += total;
  console.log(
    `  ${lang.padEnd(4)}${String(total).padStart(7)} names` +
    (collisions ? `   (${collisions} duplicate keys, first kept)` : '') +
    `   -> ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);

  // Keep wrappers and data in sync: a language with data but no wrapper module
  // is invisible to consumers (and to package.json "exports").
  if (!fs.existsSync(path.join(SRC, `translations.${lang}.mjs`))) {
    console.warn(`  ! no src/translations.${lang}.mjs wrapper - add it + a package.json export`);
  }
}
console.log(`  ${'all'.padEnd(4)}${String(grand).padStart(7)} names across ${LANGS.length} languages: ${LANGS.join(', ')}`);
