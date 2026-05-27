[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / OpaqueValue

# Class: OpaqueValue

Defined in: [properties/opaque.mjs:26](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L26)

Sub-value opaque carrier: bytes captured inside a container (array element,
map value, struct field, text body) whose own decode failed while the
surrounding shape stayed intact.

## Constructors

### Constructor

> **new OpaqueValue**(`opts?`): `OpaqueValue`

Defined in: [properties/opaque.mjs:32](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L32)

#### Parameters

##### opts?

###### bytes?

`Uint8Array`\<`ArrayBufferLike`\>

###### reason?

`string` = `null`

Free-form decode-failure reason for diagnostics.

#### Returns

`OpaqueValue`

## Properties

### bytes

> **bytes**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [properties/opaque.mjs:33](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L33)

***

### reason

> **reason**: `string`

Defined in: [properties/opaque.mjs:34](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L34)

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `sizeHint`, `reason?`): `OpaqueValue`

Defined in: [properties/opaque.mjs:47](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L47)

Capture `sizeHint` bytes from `cursor` as opaque. The caller is
responsible for calling `warnOrThrow(ctx, ...)` first; this constructor
is just bytes-in, bytes-out.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

##### sizeHint

`number`

Byte count to consume.

##### reason?

`string`

#### Returns

`OpaqueValue`

***

### toBytes()

> **toBytes**(`writer`): `void`

Defined in: [properties/opaque.mjs:53](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L53)

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

#### Returns

`void`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [properties/opaque.mjs:57](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L57)

#### Returns

`object`

##### \_opaque

> **\_opaque**: `boolean` = `true`

##### bytes

> **bytes**: `string`

##### reason

> **reason**: `string`

***

### fromJSON()

> `static` **fromJSON**(`j`): `OpaqueValue`

Defined in: [properties/opaque.mjs:65](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L65)

#### Parameters

##### j

###### bytes

`string`

###### reason?

`string`

#### Returns

`OpaqueValue`

***

### isOpaqueJSON()

> `static` **isOpaqueJSON**(`j`): `boolean`

Defined in: [properties/opaque.mjs:75](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L75)

Type guard: true iff `j` is the JSON shape produced by `toJSON`.

#### Parameters

##### j

`any`

#### Returns

`boolean`
