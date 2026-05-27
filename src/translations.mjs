/**
 * Soulmask game-data name lookups.
 *
 * Resolves the class names, object paths, and IDs that wscodec decodes from
 * actor blobs into English display names.
 *
 * @example
 * import { translate, item, npc } from 'wscodec/translations';
 *
 * item('/Game/Blueprints/DaoJu/.../BP_WuQi_Dao_2.BP_WuQi_Dao_2_C'); // 'Beast Bone Blade'
 * npc('BP_DongWu_Base_C');                                           // NPC display name
 * proficiency('FaMu');                                               // 'Logging'
 *
 * Names only - no descriptions, icons, or stats. Data is generated from the
 * game's CSV export by `scripts/build-translations.mjs`; regenerate after a
 * game patch. Zero dependencies, runs anywhere wscodec does.
 *
 * @module wscodec/translations
 */
import * as tables from './translations.data.mjs';

/**
 * Raw name tables, keyed by category (`items`, `npcs`, `recipes`, ...).
 *
 * @type {Object<string, Object<string, string>>}
 */
export { tables };

// "/Game/.../BP_X.BP_X_C", "BP_X_C", or "BP_X" -> "BP_X".
function shortClass(p) {
  if (p == null) return '';
  return String(p).split('/').pop().split('.').pop().replace(/_C$/, '');
}

const byClass = (map) => (classOrPath) => map[shortClass(classOrPath)] ?? null;
const byId = (map) => (id) => (id == null ? null : map[String(id)] ?? null);

/**
 * Item display name, by class FName or full object path.
 *
 * @function
 * @param {string} classOrPath
 * @returns {string|null}
 */
export const item = byClass(tables.items);

/**
 * NPC display name, by character class.
 *
 * @function
 * @param {string} classOrPath
 * @returns {string|null}
 */
export const npc = byClass(tables.npcs);

/**
 * Building / workbench display name, by class.
 *
 * @function
 * @param {string} classOrPath
 * @returns {string|null}
 */
export const building = byClass(tables.buildings);

/**
 * Recipe display name, by recipe id (e.g. `WuQI_Dao_2`).
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
export const recipe = byId(tables.recipes);

/**
 * Proficiency display name, by proficiency id (e.g. `FaMu`).
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
export const proficiency = byId(tables.proficiencies);

/**
 * Mastery / combat-skill display name, by numeric id.
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
export const mastery = byId(tables.mastery);

/**
 * Attribute display name, by attribute class.
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
export const attribute = byId(tables.attributes);

/**
 * Fashion / cosmetic display name, by fashion id.
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
export const fashion = byId(tables.fashion);

/**
 * Tattoo display name, by tattoo part id.
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
export const tattoo = byId(tables.tattoos);

/**
 * NPC gift / trait display name, by gift id.
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
export const gift = byId(tables.gifts);

/**
 * Game-rule setting display name, by setting code (e.g. `ExpRatio`).
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
export const setting = byId(tables.settings);

/**
 * Item-category display name, by category id.
 *
 * @function
 * @param {string|number} id
 * @returns {string|null}
 */
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
 * @example
 * translate('BP_WuQi_Dao_2_C');   // 'Beast Bone Blade'
 * translate(100011);              // first match across all tables
 * translate(100011, 'gifts');     // 'Swift Pace'
 *
 * @param {string|number} key - Class name, object path, or numeric id.
 * @param {string} [kind] - Optional table name to restrict the lookup to.
 * @returns {string|null} Display name, or `null` if not found.
 * @throws {Error} If `kind` names no known table.
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
