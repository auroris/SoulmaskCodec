[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [io](../README.md) / Cursor

# Class: Cursor

Defined in: [io.mjs:30](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L30)

Forward-only reader over a Uint8Array. All multi-byte integers are
little-endian. The cursor holds a direct DataView over the input bytes —
no copy — and advances `offset` on every read.

## Constructors

### Constructor

> **new Cursor**(`bytes`, `offset?`): `Cursor`

Defined in: [io.mjs:35](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L35)

#### Parameters

##### bytes

`Uint8Array`\<`ArrayBufferLike`\>

Backing buffer. Mutating it after construction is visible to subsequent reads.

##### offset?

`number` = `0`

Starting absolute offset (default 0).

#### Returns

`Cursor`

## Properties

### bytes

> **bytes**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [io.mjs:36](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L36)

***

### dv

> **dv**: `DataView`\<`ArrayBufferLike`\>

Defined in: [io.mjs:37](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L37)

***

### offset

> **offset**: `number`

Defined in: [io.mjs:38](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L38)

## Methods

### pos()

> **pos**(): `number`

Defined in: [io.mjs:41](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L41)

Current absolute offset within the buffer.

#### Returns

`number`

***

### eof()

> **eof**(): `boolean`

Defined in: [io.mjs:43](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L43)

True iff the cursor is at or past the end of the buffer.

#### Returns

`boolean`

***

### remaining()

> **remaining**(): `number`

Defined in: [io.mjs:45](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L45)

Bytes remaining between the cursor and the end of the buffer.

#### Returns

`number`

***

### skip()

> **skip**(`n`): `void`

Defined in: [io.mjs:55](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L55)

Advance the cursor by `n` bytes. Throws RangeError if `n` is negative or
would take the cursor past the end of the buffer. Use `seek(n)` to jump
to an absolute offset (including backwards).

#### Parameters

##### n

`number`

Non-negative number of bytes to skip.

#### Returns

`void`

#### Throws

***

### seek()

> **seek**(`n`): `void`

Defined in: [io.mjs:73](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L73)

Move the cursor to absolute offset `n`. Throws RangeError if `n` is out
of `[0, buffer.length]` (note: length is allowed; the cursor is then at
EOF and any further read would throw).

#### Parameters

##### n

`number`

Absolute offset in `[0, buffer.length]`.

#### Returns

`void`

#### Throws

***

### readUint8()

> **readUint8**(): `number`

Defined in: [io.mjs:80](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L80)

#### Returns

`number`

***

### readInt8()

> **readInt8**(): `number`

Defined in: [io.mjs:81](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L81)

#### Returns

`number`

***

### readUint16()

> **readUint16**(): `number`

Defined in: [io.mjs:82](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L82)

#### Returns

`number`

***

### readInt16()

> **readInt16**(): `number`

Defined in: [io.mjs:83](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L83)

#### Returns

`number`

***

### readUint32()

> **readUint32**(): `number`

Defined in: [io.mjs:84](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L84)

#### Returns

`number`

***

### readInt32()

> **readInt32**(): `number`

Defined in: [io.mjs:85](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L85)

#### Returns

`number`

***

### readUint64()

> **readUint64**(): `bigint`

Defined in: [io.mjs:86](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L86)

#### Returns

`bigint`

***

### readInt64()

> **readInt64**(): `bigint`

Defined in: [io.mjs:87](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L87)

#### Returns

`bigint`

***

### readFloat32()

> **readFloat32**(): `number`

Defined in: [io.mjs:88](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L88)

#### Returns

`number`

***

### readFloat64()

> **readFloat64**(): `number`

Defined in: [io.mjs:89](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L89)

#### Returns

`number`

***

### peekInt32()

> **peekInt32**(): `number`

Defined in: [io.mjs:97](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L97)

Peek a 4-byte little-endian int32 at the current position without
advancing the cursor. Used by ambiguity-resolving heuristics
(property-stream tag sniffing, ObjectRef array-element guards) that
need to look ahead before committing to a read.

#### Returns

`number`

***

### readBytes()

> **readBytes**(`n`): `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [io.mjs:109](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L109)

Read `n` bytes and return them as a Uint8Array VIEW over the underlying
buffer (no copy). The returned subarray shares storage with this cursor's
buffer: mutating it mutates the buffer, and the view becomes stale if
the buffer is detached. Callers that need to retain the bytes past the
buffer's lifetime should `.slice()` the result.

#### Parameters

##### n

`number`

Number of bytes to read.

#### Returns

`Uint8Array`\<`ArrayBufferLike`\>

Subarray view, length `n`.

***

### readFString()

> **readFString**(): [`FStringRead`](../interfaces/FStringRead.md)

Defined in: [io.mjs:127](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L127)

FString:  int32 SaveNum  (length in code units INCLUDING null terminator)
          SaveNum > 0 → ANSI;  SaveNum < 0 → UTF-16 LE;  SaveNum == 0 → empty.

The wire format distinguishes two flavors of empty:
  SaveNum =  0          → "null" form. No further bytes.
  SaveNum =  1 (or -1)  → "empty-with-terminator". 1 ANSI byte (or 1
                          UTF-16 unit) follows; both are the NUL
                          terminator. The decoded string is still "".

Both produce the same JS value (""), but to round-trip byte-identical
we need to know which one was on the wire. That distinction lives in
`isNull` on the return value.

#### Returns

[`FStringRead`](../interfaces/FStringRead.md)
