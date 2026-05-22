/**
 * Soulmask game-data name lookups.
 *
 * Resolves the class names, object paths, and IDs that wscodec decodes from
 * actor blobs into English display names.
 *
 *   import { translate, item, npc } from 'wscodec/translations';
 *
 *   item('/Game/Blueprints/DaoJu/.../BP_WuQi_Dao_2.BP_WuQi_Dao_2_C'); // 'Beast Bone Blade'
 *   npc('BP_DongWu_Base_C');                                           // NPC display name
 *   proficiency('FaMu');                                               // 'Logging'
 *
 * Names only - no descriptions, icons, or stats. Data is generated from the
 * game's CSV export by scripts/build-translations.mjs; regenerate after a
 * game patch. Zero dependencies, runs anywhere wscodec does.
 */
import * as tables from './translations.data.mjs';

/** Raw name tables, keyed by category (`items`, `npcs`, `recipes`, ...). */
export { tables };

// "/Game/.../BP_X.BP_X_C", "BP_X_C", or "BP_X" -> "BP_X".
function shortClass(p) {
  if (p == null) return '';
  return String(p).split('/').pop().split('.').pop().replace(/_C$/, '');
}

const byClass = (map) => (classOrPath) => map[shortClass(classOrPath)] ?? null;
const byId = (map) => (id) => (id == null ? null : map[String(id)] ?? null);

/** Item display name, by class FName or full object path. */
export const item = byClass(tables.items);
/** NPC display name, by character class. */
export const npc = byClass(tables.npcs);
/** Building / workbench display name, by class. */
export const building = byClass(tables.buildings);
/** Recipe display name, by recipe id (e.g. `WuQI_Dao_2`). */
export const recipe = byId(tables.recipes);
/** Proficiency display name, by proficiency id (e.g. `FaMu`). */
export const proficiency = byId(tables.proficiencies);
/** Mastery / combat-skill display name, by numeric id. */
export const mastery = byId(tables.mastery);
/** Attribute display name, by attribute class. */
export const attribute = byId(tables.attributes);
/** Fashion / cosmetic display name, by fashion id. */
export const fashion = byId(tables.fashion);
/** Tattoo display name, by tattoo part id. */
export const tattoo = byId(tables.tattoos);
/** NPC gift / trait display name, by gift id. */
export const gift = byId(tables.gifts);
/** Game-rule setting display name, by setting code (e.g. `ExpRatio`). */
export const setting = byId(tables.settings);
/** Item-category display name, by category id. */
export const category = byId(tables.categories);

/**
 * Resolve a key to a display name.
 *
 * With no `kind`, scans every table and returns the first match - handy
 * when the key's category is unknown (e.g. a class path off a decoded
 * `ObjectRef`). Pass `kind` - a table name like `'items'` or `'gifts'` -
 * to look in exactly one table. `kind` is needed to disambiguate the ~39
 * numeric IDs that exist in more than one table: Soulmask reuses ID
 * ranges across fashion, gifts, and others.
 *
 *   translate('BP_WuQi_Dao_2_C');   // 'Beast Bone Blade'
 *   translate(100011);              // first match across all tables
 *   translate(100011, 'gifts');     // 'Swift Pace'
 *
 * Returns null if the key is not found. Throws if `kind` names no table.
 */
export function translate(key, kind) {
  const k = shortClass(key);
  if (kind != null) {
    if (!(kind in tables)) {
      throw new Error(
        `unknown translation table '${kind}'; expected one of: ${Object.keys(tables).join(', ')}`);
    }
    return tables[kind][k] ?? null;
  }
  for (const table of Object.values(tables)) {
    if (k in table) return table[k];
  }
  return null;
}
