[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [translations](../README.md) / translate

# Function: translate()

> **translate**(`key`, `kind?`): `string`

Defined in: [translations.mjs:135](https://github.com/auroris/SoulmaskCodec/blob/main/src/translations.mjs#L135)

Resolve a key to a display name.

With no `kind`, scans every table and returns the first match - handy
when the key's category is unknown (e.g. a class path off a decoded
`ObjectRef`). Pass `kind` - a table name like `'items'` or `'gifts'` -
to look in exactly one table. `kind` is needed to disambiguate the ~39
numeric IDs that exist in more than one table: Soulmask reuses ID
ranges across fashion, gifts, and others.

  translate('BP_WuQi_Dao_2_C');   // 'Beast Bone Blade'
  translate(100011);              // first match across all tables
  translate(100011, 'gifts');     // 'Swift Pace'

Returns null if the key is not found. Throws if `kind` names no table.

## Parameters

### key

`string` \| `number`

### kind?

`string`

Optional table name (e.g. `'items'`, `'gifts'`).

## Returns

`string`

## Throws

when `kind` doesn't name a known table.
