[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [io](../README.md) / Writer

# Class: Writer

Defined in: [io.mjs:146](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L146)

Forward-only writer that grows its backing buffer on demand. All multi-byte
integers are written little-endian. Internal callers capture the result of
`pos()` before reserving a length placeholder and later use
`backpatchInt32` to fill it in once the actual size is known.

## Constructors

### Constructor

> **new Writer**(`initialCapacity?`): `Writer`

Defined in: [io.mjs:150](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L150)

#### Parameters

##### initialCapacity?

`number` = `256`

Starting buffer size in bytes (default 256). Buffer doubles when exhausted.

#### Returns

`Writer`

## Properties

### buffer

> **buffer**: `ArrayBuffer`

Defined in: [io.mjs:151](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L151)

***

### bytes

> **bytes**: `Uint8Array`\<`ArrayBuffer`\>

Defined in: [io.mjs:152](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L152)

***

### dv

> **dv**: `DataView`\<`ArrayBuffer`\>

Defined in: [io.mjs:153](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L153)

***

### offset

> **offset**: `number`

Defined in: [io.mjs:154](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L154)

## Methods

### pos()

> **pos**(): `number`

Defined in: [io.mjs:157](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L157)

Current absolute write offset. Capture this before reserving a placeholder slot.

#### Returns

`number`

***

### finalize()

> **finalize**(): `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [io.mjs:164](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L164)

Snapshot the written bytes as a fresh Uint8Array. The writer can be
reused after this call but the returned buffer is independent.

#### Returns

`Uint8Array`\<`ArrayBufferLike`\>

***

### \_ensure()

> **\_ensure**(`n`): `void`

Defined in: [io.mjs:166](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L166)

#### Parameters

##### n

`any`

#### Returns

`void`

***

### backpatchInt32()

> **backpatchInt32**(`pos`, `value`): `void`

Defined in: [io.mjs:189](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L189)

Overwrite a 4-byte little-endian int32 at an absolute buffer position
recorded earlier (via `pos()`). Used for tag-size back-patching: emit
the tag with a 0 placeholder, write the value bytes (which may grow
the buffer), then patch in the actual size. Resizing the buffer
preserves the prefix bytes, so an earlier-captured position stays
valid through any number of intervening writes.

#### Parameters

##### pos

`number`

Absolute byte offset of the placeholder.

##### value

`number`

Int32 value to write (`| 0` coerced).

#### Returns

`void`

***

### writeUint8()

> **writeUint8**(`v`): `void`

Defined in: [io.mjs:191](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L191)

#### Parameters

##### v

`any`

#### Returns

`void`

***

### writeInt8()

> **writeInt8**(`v`): `void`

Defined in: [io.mjs:192](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L192)

#### Parameters

##### v

`any`

#### Returns

`void`

***

### writeUint16()

> **writeUint16**(`v`): `void`

Defined in: [io.mjs:193](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L193)

#### Parameters

##### v

`any`

#### Returns

`void`

***

### writeInt16()

> **writeInt16**(`v`): `void`

Defined in: [io.mjs:194](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L194)

#### Parameters

##### v

`any`

#### Returns

`void`

***

### writeUint32()

> **writeUint32**(`v`): `void`

Defined in: [io.mjs:195](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L195)

#### Parameters

##### v

`any`

#### Returns

`void`

***

### writeInt32()

> **writeInt32**(`v`): `void`

Defined in: [io.mjs:196](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L196)

#### Parameters

##### v

`any`

#### Returns

`void`

***

### writeUint64()

> **writeUint64**(`v`): `void`

Defined in: [io.mjs:209](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L209)

Write a 64-bit unsigned integer. Accepts BigInt, a decimal string, or a
safe-integer Number (|v| <= Number.MAX_SAFE_INTEGER = 2^53 - 1). A Number
outside that range throws RangeError rather than silently losing precision
via `BigInt(largeNumber)`. The codec's decoders return I64/U64 values as
strings for this reason; this guard catches accidental mutation that
substitutes an unsafe Number.

#### Parameters

##### v

`string` \| `number` \| `bigint`

#### Returns

`void`

#### Throws

***

### writeInt64()

> **writeInt64**(`v`): `void`

Defined in: [io.mjs:216](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L216)

Signed 64-bit integer. See [Writer.writeUint64](#writeuint64) for accepted value forms.

#### Parameters

##### v

`string` \| `number` \| `bigint`

#### Returns

`void`

#### Throws

***

### writeFloat32()

> **writeFloat32**(`v`): `void`

Defined in: [io.mjs:217](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L217)

#### Parameters

##### v

`any`

#### Returns

`void`

***

### writeFloat64()

> **writeFloat64**(`v`): `void`

Defined in: [io.mjs:218](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L218)

#### Parameters

##### v

`any`

#### Returns

`void`

***

### writeBytes()

> **writeBytes**(`u8`): `void`

Defined in: [io.mjs:220](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L220)

#### Parameters

##### u8

`Uint8Array`\<`ArrayBufferLike`\>

Bytes to append verbatim.

#### Returns

`void`

***

### writeFString()

> **writeFString**(`value`, `isUnicode?`, `isNull?`): `void`

Defined in: [io.mjs:241](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L241)

Write an FString. The `isNull` parameter only matters when `value` is
the empty string (or `null`/`undefined`); for non-empty strings the
wire form is unambiguous.

  value = null/undefined         → SaveNum = 0 (null form)
  value = ''  and isNull truthy  → SaveNum = 0 (null form)
  value = ''  and isNull false   → SaveNum = 1/-1 (empty-with-terminator)
  value = ''  and isNull null    → SaveNum = 0 (default; matches prior behavior)
  value = 'x' (any non-empty)    → SaveNum encodes content

`isUnicode` is auto-detected from the content when not supplied. For
an empty-with-terminator string the caller picks the encoding via
`isUnicode` (defaults to ANSI).

#### Parameters

##### value

`string`

##### isUnicode?

`boolean` = `null`

Force ANSI/UTF-16; null = auto-detect from content.

##### isNull?

`boolean` = `null`

For empty `value` only: pick null vs. empty-with-terminator form.

#### Returns

`void`
