[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [primitives](../README.md) / FName

# Class: FName

Defined in: [primitives.mjs:38](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L38)

Interned name + wire-format flags. Soulmask's property-stream form is a
bare FString; the optional 4-byte `Number` suffix exists for stock UE
compatibility via the `*WithNumber` static/instance methods.

## Constructors

### Constructor

> **new FName**(`value`, `opts?`): `FName`

Defined in: [primitives.mjs:46](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L46)

#### Parameters

##### value

`string`

##### opts?

###### isUnicode?

`boolean` = `null`

Force ANSI/UTF-16 on write; null = auto-detect from content.

###### number?

`number` = `0`

FName.Number suffix (default 0).

###### isNull?

`boolean` = `false`

SaveNum=0 vs. empty-with-terminator distinction (only meaningful for empty string).

#### Returns

`FName`

## Properties

### value

> **value**: `string`

Defined in: [primitives.mjs:47](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L47)

***

### isUnicode

> **isUnicode**: `boolean`

Defined in: [primitives.mjs:52](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L52)

***

### number

> **number**: `number`

Defined in: [primitives.mjs:56](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L56)

***

### isNull

> **isNull**: `boolean`

Defined in: [primitives.mjs:61](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L61)

## Methods

### toString()

> **toString**(): `string`

Defined in: [primitives.mjs:63](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L63)

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `string` \| [`FNameJSON`](../interfaces/FNameJSON.md)

Defined in: [primitives.mjs:73](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L73)

JSON-friendly form. Returns the bare name string when all wire flags
are at their defaults (the common case); returns the rich object form
`{value, isUnicode, isNull, number}` when any flag is non-default, so
the wire metadata round-trips through JSON. `FName.from` accepts both
shapes.

#### Returns

`string` \| [`FNameJSON`](../interfaces/FNameJSON.md)

***

### fromReader()

> `static` **fromReader**(`cursor`): `FName`

Defined in: [primitives.mjs:85](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L85)

Read an FName in the Soulmask property-stream form: a bare FString,
no trailing FName.Number. `number` is left at 0.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

#### Returns

`FName`

***

### toBytes()

> **toBytes**(`writer`): `void`

Defined in: [primitives.mjs:95](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L95)

Write the Soulmask form (FString only).

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

#### Returns

`void`

***

### fromReaderWithNumber()

> `static` **fromReaderWithNumber**(`cursor`): `FName`

Defined in: [primitives.mjs:105](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L105)

Read an FName in the stock UE 4.27 property-tag form: FString + int32
Number. Use this if you're decoding a non-Soulmask stream or a future
Soulmask wire format that re-adopts the int32 suffix.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

#### Returns

`FName`

***

### toBytesWithNumber()

> **toBytesWithNumber**(`writer`): `void`

Defined in: [primitives.mjs:116](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L116)

Write the stock UE form (FString + int32 Number).

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

#### Returns

`void`

***

### from()

> `static` **from**(`x`): `FName`

Defined in: [primitives.mjs:129](https://github.com/auroris/SoulmaskCodec/blob/main/src/primitives.mjs#L129)

Coerce an arbitrary input into an FName. Idempotent on existing FName
instances. Accepts a bare string or the rich `{value, isUnicode, isNull, number}` JSON shape.

#### Parameters

##### x

`string` \| `FName` \| [`FNameJSON`](../interfaces/FNameJSON.md)

#### Returns

`FName`

#### Throws

on unsupported types.
