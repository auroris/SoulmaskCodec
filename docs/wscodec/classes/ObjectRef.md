[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / ObjectRef

# Class: ObjectRef

Defined in: [properties/object.mjs:39](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L39)

Decoded ObjectProperty value. Carries every wire-form variant — kind-only,
+path, +path+classPath, +embedded PropertyStream — plus the Soulmask
`kindOnePrefix` u32 (semantic unknown, replayed verbatim).

## Constructors

### Constructor

> **new ObjectRef**(`opts?`): `ObjectRef`

Defined in: [properties/object.mjs:51](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L51)

#### Parameters

##### opts?

###### kind?

`number` = `0x03`

Wire kind byte (0x03 = path; 0x01 = Soulmask actor ref; 0 = null).

###### kindOnePrefix?

`number` = `null`

u32 following a kind=0x01 byte. null = "not on the wire".

###### path?

`string` = `null`

null = the FString wasn't on the wire.

###### pathIsNull?

`boolean` = `false`

Wire FString null-form vs. empty-with-terminator.

###### classPath?

`string` = `null`

null = not on wire.

###### classPathIsNull?

`boolean` = `false`

###### embedded?

[`PropertyStream`](PropertyStream.md) = `null`

###### hasTerminatorTrailer?

`boolean` = `false`

Embedded stream's None terminator carried a 4-byte trailer.

#### Returns

`ObjectRef`

## Properties

### kind

> **kind**: `number`

Defined in: [properties/object.mjs:61](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L61)

***

### kindOnePrefix

> **kindOnePrefix**: `number`

Defined in: [properties/object.mjs:65](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L65)

***

### path

> **path**: `string`

Defined in: [properties/object.mjs:66](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L66)

***

### pathIsNull

> **pathIsNull**: `boolean`

Defined in: [properties/object.mjs:67](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L67)

***

### classPath

> **classPath**: `string`

Defined in: [properties/object.mjs:68](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L68)

***

### classPathIsNull

> **classPathIsNull**: `boolean`

Defined in: [properties/object.mjs:69](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L69)

***

### embedded

> **embedded**: [`PropertyStream`](PropertyStream.md)

Defined in: [properties/object.mjs:70](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L70)

***

### hasTerminatorTrailer

> **hasTerminatorTrailer**: `boolean`

Defined in: [properties/object.mjs:75](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L75)

## Accessors

### hasEmbedded

#### Get Signature

> **get** **hasEmbedded**(): `boolean`

Defined in: [properties/object.mjs:79](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L79)

True iff `embedded` is a non-null [PropertyStream](PropertyStream.md).

##### Returns

`boolean`

## Methods

### fromReaderTopLevel()

> `static` **fromReaderTopLevel**(`cursor`, `sizeHint`, `ctx?`): `ObjectRef`

Defined in: [properties/object.mjs:91](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L91)

Top-level read: `sizeHint` is the tight per-property byte budget from
the tag. The reader steps through kind / kindOnePrefix / path /
classPath / embedded, falling out at each "exhausted budget" check.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

##### sizeHint

`number`

Tag size budget for the value bytes.

##### ctx?

`any`

Decode context (e.g. `{ strict?: boolean }`).

#### Returns

`ObjectRef`

***

### fromReaderArrayElement()

> `static` **fromReaderArrayElement**(`cursor`, `sizeHint`, `ctx?`): `ObjectRef`

Defined in: [properties/object.mjs:169](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L169)

Array-element read. `sizeHint` here is the REMAINING array budget,
not a per-element bound, because ArrayProperty<Object> has no per-
element delimiter on the wire. The four guards decide where this
element actually ends.

Heuristics preamble: ObjectProperty array elements have one of four
wire shapes, all back-to-back with no separator:

  (A) kind-only         1 byte
  (B) kind+path         1 byte + FString
  (C) kind+path+class   1 byte + FString + FString
  (D) kind+path+class+embedded property stream  (terminated by None)

Each guard catches a different way the loose budget could mislead the
reader into consuming the next element's bytes:

  Guard 1: no room for even a null-form classPath FString (4 bytes).
  Guard 2: peek classPath saveNum is implausibly large (|n| > 1024).
  Guard 3: classPath's first content byte isn't '/' (Soulmask asset
           paths are always "/Script/..." or "/Game/...").
  Guard 4: bytes following classPath don't look like a PropertyTag
           start (small ANSI saveNum + identifier-start byte).

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

##### sizeHint

`number`

Remaining array byte budget (NOT a per-element bound).

##### ctx?

`any`

Decode context (e.g. `{ strict?: boolean }`).

#### Returns

`ObjectRef`

***

### toBytes()

> **toBytes**(`writer`, `opts?`): `void`

Defined in: [properties/object.mjs:306](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L306)

Emit the wire form that matches which fields were captured at read time
(or set programmatically). The kind byte is always emitted; subsequent
fields are written only when present.

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

##### opts?

###### requireClassPath?

`boolean` = `false`

Force emission of classPath even when it's null (used by container codecs that need positional fields).

###### ctx?

`any` = `{}`

#### Returns

`void`

***

### toJSON()

> **toJSON**(): `any`

Defined in: [properties/object.mjs:323](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L323)

#### Returns

`any`

***

### fromJSON()

> `static` **fromJSON**(`j`): `ObjectRef`

Defined in: [properties/object.mjs:339](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L339)

#### Parameters

##### j

`any`

#### Returns

`ObjectRef`
