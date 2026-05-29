/**
 * Soulmask game-data name lookups - locale-neutral core.
 *
 * This module ships no name tables. It exposes {@link createTranslations},
 * which binds a set of tables (one language's worth) to the lookup API. Import
 * a language instead to get ready-bound lookups:
 *
 *   import { translate, item, npc } from 'wscodec/translations/en';
 *
 * Use this module directly only to bind your own table set:
 *
 *   import { createTranslations } from 'wscodec/translations';
 *   import * as de from 'wscodec/translations/de';   // or your own tables
 *   const t = createTranslations(de.tables);
 *
 * Names only - no descriptions, icons, or stats. Tables are generated from the
 * game's CSV export by scripts/build-translations.mjs. Zero dependencies, runs
 * anywhere wscodec does.
 */

/**
 * A set of name tables for one language, keyed by category.
 * @typedef {Record<string, Record<string, string>>} Tables
 */

/**
 * The lookup API bound to one language's {@link Tables}.
 * @typedef {object} Translations
 * @property {Tables} tables  Raw name tables, keyed by category.
 * @property {(classOrPath: string|null|undefined) => string|null} item       Item display name, by class FName or full object path.
 * @property {(classOrPath: string|null|undefined) => string|null} npc        NPC display name, by character class.
 * @property {(classOrPath: string|null|undefined) => string|null} building   Building / workbench display name, by class.
 * @property {(id: string|number|null|undefined) => string|null} recipe       Recipe display name, by recipe id (e.g. `WuQi_Dao_2`).
 * @property {(id: string|number|null|undefined) => string|null} proficiency  Proficiency display name, by proficiency id (e.g. `FaMu`).
 * @property {(id: string|number|null|undefined) => string|null} mastery      Mastery / combat-skill display name, by numeric id.
 * @property {(id: string|number|null|undefined) => string|null} attribute    Attribute display name, by attribute class.
 * @property {(id: string|number|null|undefined) => string|null} fashion      Fashion / cosmetic display name, by fashion id.
 * @property {(id: string|number|null|undefined) => string|null} tattoo       Tattoo display name, by tattoo part id.
 * @property {(id: string|number|null|undefined) => string|null} gift         NPC gift / trait display name, by gift id.
 * @property {(id: string|number|null|undefined) => string|null} setting      Game-rule setting display name, by setting code (e.g. `ExpRatio`).
 * @property {(id: string|number|null|undefined) => string|null} category     Item-category display name, by category id.
 * @property {(key: string|number|null|undefined, kind?: string) => string|null} translate  Resolve a key to a display name; see {@link createTranslations}.
 */

/**
 * Normalize a class FName or full object path to its bare short class name:
 *   `"/Game/.../BP_X.BP_X_C"` → `"BP_X"`
 *   `"BP_X_C"`                → `"BP_X"`
 *   `"BP_X"`                  → `"BP_X"`
 *
 * @param {string|null|undefined} p
 * @returns {string}
 */
export function shortClass(p) {
  if (p == null) return '';
  return String(p).split('/').pop().split('.').pop().replace(/_C$/, '');
}

/**
 * @internal
 * @param {Record<string, string>} map
 * @returns {(classOrPath: string|null|undefined) => string|null}
 */
const byClass = (map) => (classOrPath) => map[shortClass(classOrPath)] ?? null;
/**
 * @internal
 * @param {Record<string, string>} map
 * @returns {(id: string|number|null|undefined) => string|null}
 */
const byId = (map) => (id) => (id == null ? null : map[String(id)] ?? null);

/**
 * Bind one language's name {@link Tables} to the lookup API.
 *
 * The returned `translate(key, kind)` resolves a key to a display name. With no
 * `kind`, it scans every table and returns the first match - handy when the
 * key's category is unknown (e.g. a class path off a decoded `ObjectRef`).
 * Pass `kind` - a table name like `'items'` or `'gifts'` - to look in exactly
 * one table. `kind` is needed to disambiguate the numeric IDs that exist in
 * more than one table: Soulmask reuses ID ranges across fashion, gifts, and
 * others. `translate` returns null if the key is not found, and throws if
 * `kind` names no table.
 *
 *   const t = createTranslations(tables);
 *   t.item('/Game/Blueprints/DaoJu/.../BP_WuQi_Dao_2.BP_WuQi_Dao_2_C'); // item name
 *   t.translate('BP_WuQi_Dao_2_C');                                     // first match
 *   t.translate(100011, 'gifts');                                       // disambiguate
 *
 * @param {Tables} tables  Name tables keyed by category (`items`, `npcs`, ...).
 * @returns {Translations}
 */
export function createTranslations(tables) {
  /**
   * @param {string|number|null|undefined} key
   * @param {string} [kind]  Optional table name (e.g. `'items'`, `'gifts'`).
   * @returns {string|null}
   * @throws {Error} when `kind` doesn't name a known table.
   */
  function translate(key, kind) {
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

  return {
    tables,
    item: byClass(tables.items),
    npc: byClass(tables.npcs),
    building: byClass(tables.buildings),
    recipe: byId(tables.recipes),
    proficiency: byId(tables.proficiencies),
    mastery: byId(tables.mastery),
    attribute: byId(tables.attributes),
    fashion: byId(tables.fashion),
    tattoo: byId(tables.tattoos),
    gift: byId(tables.gifts),
    setting: byId(tables.settings),
    category: byId(tables.categories),
    translate,
  };
}
