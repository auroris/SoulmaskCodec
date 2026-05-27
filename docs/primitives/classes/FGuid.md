[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [primitives](../README.md) / FGuid

# Class: FGuid

Defined in: [primitives.mjs:150](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L150)

Globally-unique identifier. Stored canonically as an 8-4-4-4-12 uppercase
hex string; instances compare case-insensitively via [FGuid.equals](#equals).

## Constructors

### Constructor

> **new FGuid**(`value`): `FGuid`

Defined in: [primitives.mjs:154](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L154)

#### Parameters

##### value

`string`

Canonical 8-4-4-4-12 hex string (any case; not validated until `toBytes`).

#### Returns

`FGuid`

## Properties

### value

> **value**: `string`

Defined in: [primitives.mjs:154](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L154)

## Methods

### toString()

> **toString**(): `string`

Defined in: [primitives.mjs:155](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L155)

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `string`

Defined in: [primitives.mjs:163](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L163)

JSON-friendly form: the bare GUID string, so `JSON.stringify(fguid)`
yields `"AABBCCDD-..."` rather than `{"value":"AABBCCDD-..."}`.

#### Returns

`string`

***

### equals()

> **equals**(`other`): `boolean`

Defined in: [primitives.mjs:173](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L173)

Structural equality. Case-insensitive: an FGuid constructed from a
lowercase string compares equal to one read off the wire (uppercase).
Accepts an FGuid or a string; anything else returns false.

#### Parameters

##### other

`unknown`

#### Returns

`boolean`

***

### isZero()

> **isZero**(): `boolean`

Defined in: [primitives.mjs:182](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L182)

True iff the GUID is all zeros (the conventional null-GUID sentinel).

#### Returns

`boolean`

***

### zero()

> `static` **zero**(): `FGuid`

Defined in: [primitives.mjs:185](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L185)

All-zero FGuid sentinel. New instance per call (FGuid is mutable).

#### Returns

`FGuid`

***

### fromReader()

> `static` **fromReader**(`cursor`): `FGuid`

Defined in: [primitives.mjs:194](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L194)

Read 16 bytes as four little-endian u32s and format them as the
canonical 8-4-4-4-12 uppercase hex string.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

#### Returns

`FGuid`

***

### toBytes()

> **toBytes**(`writer`): `void`

Defined in: [primitives.mjs:206](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L206)

Emit 16 bytes (four little-endian u32s) reconstructed from the hex string.

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

#### Returns

`void`

#### Throws

if `value` is not a canonical GUID string.

***

### from()

> `static` **from**(`x`): `FGuid`

Defined in: [primitives.mjs:223](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L223)

Coerce an input into an FGuid. Idempotent on existing FGuid instances.

#### Parameters

##### x

`string` \| `FGuid`

#### Returns

`FGuid`

#### Throws

on unsupported types.
