[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [translations.core](../README.md) / createTranslations

# Function: createTranslations()

> **createTranslations**(`tables`): [`Translations`](../interfaces/Translations.md)

Defined in: translations.core.mjs:92

Bind one language's name [Tables](../type-aliases/Tables.md) to the lookup API.

The returned `translate(key, kind)` resolves a key to a display name. With no
`kind`, it scans every table and returns the first match - handy when the
key's category is unknown (e.g. a class path off a decoded `ObjectRef`).
Pass `kind` - a table name like `'items'` or `'gifts'` - to look in exactly
one table. `kind` is needed to disambiguate the numeric IDs that exist in
more than one table: Soulmask reuses ID ranges across fashion, gifts, and
others. `translate` returns null if the key is not found, and throws if
`kind` names no table.

  const t = createTranslations(tables);
  t.item('/Game/Blueprints/DaoJu/.../BP_WuQi_Dao_2.BP_WuQi_Dao_2_C'); // item name
  t.translate('BP_WuQi_Dao_2_C');                                     // first match
  t.translate(100011, 'gifts');                                       // disambiguate

## Parameters

### tables

`Record`\<`string`, `Record`\<`string`, `string`\>\>

Name tables keyed by category (`items`, `npcs`, ...).

## Returns

[`Translations`](../interfaces/Translations.md)
