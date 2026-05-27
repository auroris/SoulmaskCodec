#!/usr/bin/env node
/**
 * Generate src/translations.data.mjs from the game-data CSV export in ext/.
 *
 *   npm run build-translations
 *
 * ext/ is the raw export (gitignored, ~118 MB). The generated data module is
 * compact, committed, and shipped in the package - so a normal install/build
 * never needs ext/. Re-run this after a game patch refreshes ext/.
 *
 * Only display-name text is extracted: no descriptions, icons, or stats.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'ext');
const OUT = path.join(ROOT, 'src', 'translations.data.mjs');

if (!fs.existsSync(EXT)) {
  console.error(`ext/ not found at ${EXT}`);
  console.error('Drop the game-data CSV export there, then re-run.');
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

// Parse an ext/ CSV into objects keyed by trimmed header name.
function readTable(relPath) {
  const rows = parseCsv(fs.readFileSync(path.join(EXT, relPath), 'utf8'));
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

// Relative paths of every *.csv in an ext/ subdir.
function csvsIn(dir) {
  return fs.readdirSync(path.join(EXT, dir))
    .filter(f => f.toLowerCase().endsWith('.csv'))
    .map(f => `${dir}/${f}`);
}

// ── extraction sources ──────────────────────────────────────────────────────
// keyKind 'class' normalizes the key via shortClass; 'raw' keeps it verbatim.
const SOURCES = [
  { cat: 'items',         files: ['Item/Item.csv'],              keyCols: ['class'], nameCol: 'name', keyKind: 'class' },
  { cat: 'npcs',          files: csvsIn('Npc'),                  keyCols: ['class'], nameCol: 'name', keyKind: 'class' },
  { cat: 'buildings',     files: ['Recipe/Workbenches.csv', 'Building/Building.csv'], keyCols: ['class'], nameCol: 'name', keyKind: 'class' },
  { cat: 'recipes',       files: csvsIn('Recipe').filter(f => !/Workbenches\.csv$/.test(f)), keyCols: ['id'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'proficiencies', files: ['Proficiency/Proficiency.csv'], keyCols: ['id'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'mastery',       files: ['Mastery/Mastery.csv'],        keyCols: ['id'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'attributes',    files: ['Attribute/Attribute.csv'],    keyCols: ['class'], nameCol: 'desc', keyKind: 'raw' },
  { cat: 'fashion',       files: ['Fashion/Fashion.csv'],        keyCols: ['id_m', 'id_f'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'tattoos',       files: ['WenShen/WenShen.csv'],        keyCols: ['head_m', 'head_f', 'chest_m', 'chest_f', 'arm_m', 'arm_f', 'leg_m', 'leg_f'], nameCol: 'name', keyKind: 'raw' },
  { cat: 'gifts',         files: csvsIn('Gift'),                 keyCols: ['Level 1', 'Level 2', 'Level 3'], nameCol: 'Title', keyKind: 'raw' },
  { cat: 'settings',      files: ['XiShu/XiShu_0.csv', 'XiShu/XiShu_1.csv', 'XiShu/XiShu_2.csv'], keyCols: ['name'], nameCol: 'desc', keyKind: 'raw' },
];

const out = {};
const stats = [];

for (const src of SOURCES) {
  const map = {};
  let collisions = 0;
  for (const file of src.files) {
    let table;
    try { table = readTable(file); }
    catch (e) { console.warn(`  skipped ${file}: ${e.message}`); continue; }
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
  stats.push({ cat: src.cat, entries: Object.keys(map).length, collisions });
}

// Item-category id -> name, from Item.csv's cat / cat_name columns.
{
  const cats = {};
  for (const row of readTable('Item/Item.csv')) {
    const id = (row.cat ?? '').trim(), nm = (row.cat_name ?? '').trim();
    if (id && nm && !(id in cats)) cats[id] = nm;
  }
  out.categories = cats;
  stats.push({ cat: 'categories', entries: Object.keys(cats).length, collisions: 0 });
}

// ── emit ────────────────────────────────────────────────────────────────────
// Keys are sorted so regeneration produces a stable, reviewable diff.
const banner =
  '// GENERATED by scripts/build-translations.mjs - do not edit by hand.\n' +
  '// Soulmask game-data name tables; regenerate after a game patch.\n\n';

const body = Object.entries(out).map(([cat, map]) => {
  const lines = Object.keys(map).sort()
    .map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])},`);
  return `export const ${cat} = {\n${lines.join('\n')}\n};\n`;
}).join('\n');

fs.writeFileSync(OUT, banner + body);

const total = stats.reduce((s, x) => s + x.entries, 0);
for (const s of stats) {
  console.log(`  ${s.cat.padEnd(14)}${String(s.entries).padStart(7)}` +
    (s.collisions ? `   (${s.collisions} duplicate keys, first kept)` : ''));
}
console.log(`  ${'TOTAL'.padEnd(14)}${String(total).padStart(7)}`);
console.log(`wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
