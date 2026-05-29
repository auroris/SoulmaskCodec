/**
 * Soulmask game-data name lookups - Korean (ko).
 *
 *   import { translate, item, npc, recipe } from 'wscodec/translations/ko';
 *
 * See {@link module:translations.core} ('wscodec/translations') for the shared
 * lookup API and `translate` semantics.
 */
import * as data from './translations.data.ko.mjs';
import { createTranslations } from './translations.core.mjs';

export const {
  tables, item, npc, building, recipe, proficiency, mastery,
  attribute, fashion, tattoo, gift, setting, category, translate,
} = createTranslations(data);
