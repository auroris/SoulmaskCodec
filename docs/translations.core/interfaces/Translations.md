[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [translations.core](../README.md) / Translations

# Interface: Translations

Defined in: translations.core.mjs:28

## Properties

### tables

> **tables**: `Record`\<`string`, `Record`\<`string`, `string`\>\>

Defined in: translations.core.mjs:29

Raw name tables, keyed by category.

***

### item

> **item**: (`classOrPath`) => `string`

Defined in: translations.core.mjs:30

Item display name, by class FName or full object path.

#### Parameters

##### classOrPath

`string`

#### Returns

`string`

***

### npc

> **npc**: (`classOrPath`) => `string`

Defined in: translations.core.mjs:31

NPC display name, by character class.

#### Parameters

##### classOrPath

`string`

#### Returns

`string`

***

### building

> **building**: (`classOrPath`) => `string`

Defined in: translations.core.mjs:32

Building / workbench display name, by class.

#### Parameters

##### classOrPath

`string`

#### Returns

`string`

***

### recipe

> **recipe**: (`id`) => `string`

Defined in: translations.core.mjs:33

Recipe display name, by recipe id (e.g. `WuQi_Dao_2`).

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### proficiency

> **proficiency**: (`id`) => `string`

Defined in: translations.core.mjs:34

Proficiency display name, by proficiency id (e.g. `FaMu`).

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### mastery

> **mastery**: (`id`) => `string`

Defined in: translations.core.mjs:35

Mastery / combat-skill display name, by numeric id.

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### attribute

> **attribute**: (`id`) => `string`

Defined in: translations.core.mjs:36

Attribute display name, by attribute class.

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### fashion

> **fashion**: (`id`) => `string`

Defined in: translations.core.mjs:37

Fashion / cosmetic display name, by fashion id.

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### tattoo

> **tattoo**: (`id`) => `string`

Defined in: translations.core.mjs:38

Tattoo display name, by tattoo part id.

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### gift

> **gift**: (`id`) => `string`

Defined in: translations.core.mjs:39

NPC gift / trait display name, by gift id.

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### setting

> **setting**: (`id`) => `string`

Defined in: translations.core.mjs:40

Game-rule setting display name, by setting code (e.g. `ExpRatio`).

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### category

> **category**: (`id`) => `string`

Defined in: translations.core.mjs:41

Item-category display name, by category id.

#### Parameters

##### id

`string` \| `number`

#### Returns

`string`

***

### translate

> **translate**: (`key`, `kind?`) => `string`

Defined in: translations.core.mjs:42

Resolve a key to a display name; see [createTranslations](../functions/createTranslations.md).

#### Parameters

##### key

`string` \| `number`

##### kind?

`string`

#### Returns

`string`
