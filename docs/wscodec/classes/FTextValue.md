[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / FTextValue

# Class: FTextValue

Defined in: [properties/text.mjs:70](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L70)

Decoded FText. The active fields depend on `historyType`:

- `-1` (None / culture-invariant): `displayString`, `displayStringIsNull`.
- `0`  (Base / localized): `namespace`, `key`, `sourceString` (+isNull pairs).
- `1`  (NamedFormat): `sourceFmt`, `arguments` of `{key, keyIsNull, type, value}`.
- `2`  (OrderedFormat): `sourceFmt`, `arguments` of `{type, value}`.
- `4`  (AsNumber): `sourceValue`, `formatOptions`, `culture`.
- `11` (StringTableEntry): `tableId` (FName), `tableKey` (FString).
- other: opaque `_raw` bytes captured for verbatim round-trip.

## Constructors

### Constructor

> **new FTextValue**(`opts?`): `FTextValue`

Defined in: [properties/text.mjs:94](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L94)

#### Parameters

##### opts?

###### flags?

`number` = `0`

###### historyType?

`number` = `-1`

###### displayString?

`string`

###### displayStringIsNull?

`boolean` = `false`

###### namespace?

`string`

###### namespaceIsNull?

`boolean` = `false`

###### key?

`string`

###### keyIsNull?

`boolean` = `false`

###### sourceString?

`string`

###### sourceStringIsNull?

`boolean` = `false`

###### sourceFmt?

`FTextValue`

###### arguments?

`any`[]

###### sourceValue?

\{ `type`: `number`; `value`: `any`; \}

###### sourceValue.type

`number`

###### sourceValue.value

`any`

###### formatOptions?

`any`

###### culture?

`string`

###### cultureIsNull?

`boolean` = `false`

###### tableId?

[`FName`](../../primitives/classes/FName.md)

###### tableKey?

`string`

###### tableKeyIsNull?

`boolean` = `false`

###### _raw?

`Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`FTextValue`

## Properties

### flags

> **flags**: `number`

Defined in: [properties/text.mjs:105](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L105)

***

### historyType

> **historyType**: `number`

Defined in: [properties/text.mjs:106](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L106)

***

### displayString

> **displayString**: `string`

Defined in: [properties/text.mjs:108](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L108)

***

### displayStringIsNull

> **displayStringIsNull**: `boolean`

Defined in: [properties/text.mjs:109](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L109)

***

### namespace

> **namespace**: `string`

Defined in: [properties/text.mjs:111](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L111)

***

### namespaceIsNull

> **namespaceIsNull**: `boolean`

Defined in: [properties/text.mjs:112](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L112)

***

### key

> **key**: `string`

Defined in: [properties/text.mjs:113](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L113)

***

### keyIsNull

> **keyIsNull**: `boolean`

Defined in: [properties/text.mjs:114](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L114)

***

### sourceString

> **sourceString**: `string`

Defined in: [properties/text.mjs:115](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L115)

***

### sourceStringIsNull

> **sourceStringIsNull**: `boolean`

Defined in: [properties/text.mjs:116](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L116)

***

### sourceFmt

> **sourceFmt**: `FTextValue`

Defined in: [properties/text.mjs:118](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L118)

***

### arguments

> **arguments**: `any`[]

Defined in: [properties/text.mjs:119](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L119)

***

### sourceValue

> **sourceValue**: `object`

Defined in: [properties/text.mjs:124](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L124)

#### type

> **type**: `number`

#### value

> **value**: `any`

***

### formatOptions

> **formatOptions**: `any`

Defined in: [properties/text.mjs:125](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L125)

***

### culture

> **culture**: `string`

Defined in: [properties/text.mjs:126](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L126)

***

### cultureIsNull

> **cultureIsNull**: `boolean`

Defined in: [properties/text.mjs:127](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L127)

***

### tableId

> **tableId**: [`FName`](../../primitives/classes/FName.md)

Defined in: [properties/text.mjs:129](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L129)

***

### tableKey

> **tableKey**: `string`

Defined in: [properties/text.mjs:130](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L130)

***

### tableKeyIsNull

> **tableKeyIsNull**: `boolean`

Defined in: [properties/text.mjs:131](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L131)

***

### \_raw

> **\_raw**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [properties/text.mjs:133](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L133)

## Accessors

### text

#### Get Signature

> **get** **text**(): `string`

Defined in: [properties/text.mjs:143](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L143)

Best displayable string for this FText, or null if none. Walks
historyType-specific fields to find a text-bearing value.

##### Returns

`string`

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `sizeHint`, `ctx?`): `FTextValue`

Defined in: [properties/text.mjs:168](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L168)

Read an FText. `sizeHint` is the byte budget when called as a top-level
TextProperty value or inside a finite-budget container; pass `Infinity`
when reading inside a self-delimiting context (array element, struct
field) and an unknown historyType cannot be captured.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

##### sizeHint

`number`

##### ctx?

`any`

Decode context (e.g. `{ strict?: boolean }`).

#### Returns

`FTextValue`

#### Throws

on unimplemented historyType with no size budget.

***

### toBytes()

> **toBytes**(`writer`): `void`

Defined in: [properties/text.mjs:263](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L263)

#### Parameters

##### writer

`any`

#### Returns

`void`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [properties/text.mjs:316](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L316)

#### Returns

`object`

##### flags

> **flags**: `number`

##### historyType

> **historyType**: `number`

***

### fromJSON()

> `static` **fromJSON**(`j`): `any`

Defined in: [properties/text.mjs:359](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L359)

#### Parameters

##### j

`any`

#### Returns

`any`
