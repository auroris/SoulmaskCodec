[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / StructValue

# Class: StructValue

Defined in: [properties/struct.mjs:108](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L108)

Decoded struct value carrying one of three wire forms:
- `'binary'`: a plain object produced by a registered [STRUCT\_HANDLERS](../variables/STRUCT_HANDLERS.md) entry.
- `'propStream'`: a nested [PropertyStream](PropertyStream.md) terminated by `None`.
- `'decodeError'`: a non-strict fallback that captures the raw element bytes as `opaqueTail`.

Used by [StructProperty](StructProperty.md), `ArrayProperty<Struct>` elements, and
`MapProperty<_, Struct>` entry values.

## Constructors

### Constructor

> **new StructValue**(`structName`, `opts?`): `StructValue`

Defined in: [properties/struct.mjs:118](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L118)

#### Parameters

##### structName

`string`

##### opts?

###### form?

`"binary"` \| `"propStream"` \| `"decodeError"` = `null`

###### binaryValue?

`any` = `null`

Plain object/string/[FGuid](../../primitives/classes/FGuid.md) for `'binary'` form.

###### stream?

[`PropertyStream`](PropertyStream.md) = `null`

Nested stream for `'propStream'` form.

###### decodeError?

`string` = `null`

Error message for `'decodeError'` form.

###### opaqueTail?

`Uint8Array`\<`ArrayBufferLike`\> = `null`

Captured raw bytes for `'decodeError'` form.

#### Returns

`StructValue`

## Properties

### structName

> **structName**: `string`

Defined in: [properties/struct.mjs:125](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L125)

***

### form

> **form**: `"binary"` \| `"propStream"` \| `"decodeError"`

Defined in: [properties/struct.mjs:128](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L128)

***

### binaryValue

> **binaryValue**: `any`

Defined in: [properties/struct.mjs:129](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L129)

***

### stream

> **stream**: [`PropertyStream`](PropertyStream.md)

Defined in: [properties/struct.mjs:130](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L130)

***

### decodeError

> **decodeError**: `string`

Defined in: [properties/struct.mjs:131](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L131)

***

### opaqueTail

> **opaqueTail**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [properties/struct.mjs:132](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L132)

## Accessors

### isKnownBinary

#### Get Signature

> **get** **isKnownBinary**(): `boolean`

Defined in: [properties/struct.mjs:136](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L136)

True iff [STRUCT\_HANDLERS](../variables/STRUCT_HANDLERS.md) has a binary handler for this struct name.

##### Returns

`boolean`

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `structName`, `sizeHint`, `ctx?`, `opts?`): `StructValue`

Defined in: [properties/struct.mjs:152](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L152)

Read a struct value. `peekTagged` controls whether the peek heuristic
is consulted before dispatching to a registered binary handler — used
inside Map<_,Struct> value reads where Soulmask encodes some
known-binary structs as tagged streams.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

##### structName

`string`

##### sizeHint

`number`

Tag size budget, or `Infinity` for loose container budgets.

##### ctx?

`any`

Decode context (e.g. `{ strict?: boolean }`).

##### opts?

###### peekTagged?

`boolean` = `false`

#### Returns

`StructValue`

***

### fromReaderTagged()

> `static` **fromReaderTagged**(`cursor`, `structName`, `ctx?`): `StructValue`

Defined in: [properties/struct.mjs:197](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L197)

Read a struct value WITHOUT consulting STRUCT_HANDLERS (always uses
the property-stream path). Used by Map<Struct,Struct> entry values
once the peek heuristic has decided the bytes are tagged.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

##### structName

`string`

##### ctx?

`any`

Decode context (e.g. `{ strict?: boolean }`).

#### Returns

`StructValue`

***

### toBytes()

> **toBytes**(`writer`, `ctx?`): `void`

Defined in: [properties/struct.mjs:209](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L209)

Dispatch on `this.form` and emit the appropriate wire shape.

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

##### ctx?

`any` = `{}`

#### Returns

`void`

#### Throws

on unknown form or missing binary handler.

***

### toJSON()

> **toJSON**(): \{ `form`: `string`; `structName`: `string`; `error`: `string`; `opaqueTail`: `string`; `stream?`: `undefined`; `value?`: `undefined`; \} \| \{ `error?`: `undefined`; `opaqueTail?`: `undefined`; `form`: `string`; `structName`: `string`; `stream`: `any`; `value?`: `undefined`; \} \| \{ `error?`: `undefined`; `opaqueTail?`: `undefined`; `stream?`: `undefined`; `form`: `string`; `structName`: `string`; `value`: `any`; \}

Defined in: [properties/struct.mjs:236](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L236)

Write the property-stream BODY only (no None terminator). Used by
Map<_, StructProperty> entry values where the surrounding writer
emits its own terminator.

Currently unused — Map's writer goes through the stream's toBytes
which DOES emit None. Kept for symmetry should we need a no-None form.

#### Returns

\{ `form`: `string`; `structName`: `string`; `error`: `string`; `opaqueTail`: `string`; `stream?`: `undefined`; `value?`: `undefined`; \} \| \{ `error?`: `undefined`; `opaqueTail?`: `undefined`; `form`: `string`; `structName`: `string`; `stream`: `any`; `value?`: `undefined`; \} \| \{ `error?`: `undefined`; `opaqueTail?`: `undefined`; `stream?`: `undefined`; `form`: `string`; `structName`: `string`; `value`: `any`; \}

***

### fromJSON()

> `static` **fromJSON**(`j`): `StructValue`

Defined in: [properties/struct.mjs:258](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L258)

#### Parameters

##### j

`any`

#### Returns

`StructValue`
