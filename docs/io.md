# wscodec/io

Source: [`src/io.mjs`](../src/io.mjs)

<a name="module_wscodec/io"></a>

## wscodec/io
Cursor + Writer: byte-level read/write primitives over a Uint8Array.No Unreal semantics here. FString lives here too because it's a statefulread/write on the same DataView; everything else (FName, FGuid, structs,properties) builds on top of these.


* [wscodec/io](#module_wscodec/io)
    * _static_
        * [.Cursor](#module_wscodec/io.Cursor)
            * [new exports.Cursor(bytes, [offset])](#new_module_wscodec/io.Cursor_new)
            * [.pos()](#module_wscodec/io.Cursor+pos) ⇒ <code>number</code>
            * [.eof()](#module_wscodec/io.Cursor+eof) ⇒ <code>boolean</code>
            * [.remaining()](#module_wscodec/io.Cursor+remaining) ⇒ <code>number</code>
            * [.skip(n)](#module_wscodec/io.Cursor+skip)
            * [.seek(n)](#module_wscodec/io.Cursor+seek)
            * [.readUint8()](#module_wscodec/io.Cursor+readUint8) ⇒ <code>number</code>
            * [.readInt8()](#module_wscodec/io.Cursor+readInt8) ⇒ <code>number</code>
            * [.readUint16()](#module_wscodec/io.Cursor+readUint16) ⇒ <code>number</code>
            * [.readInt16()](#module_wscodec/io.Cursor+readInt16) ⇒ <code>number</code>
            * [.readUint32()](#module_wscodec/io.Cursor+readUint32) ⇒ <code>number</code>
            * [.readInt32()](#module_wscodec/io.Cursor+readInt32) ⇒ <code>number</code>
            * [.readUint64()](#module_wscodec/io.Cursor+readUint64) ⇒ <code>bigint</code>
            * [.readInt64()](#module_wscodec/io.Cursor+readInt64) ⇒ <code>bigint</code>
            * [.readFloat32()](#module_wscodec/io.Cursor+readFloat32) ⇒ <code>number</code>
            * [.readFloat64()](#module_wscodec/io.Cursor+readFloat64) ⇒ <code>number</code>
            * [.peekInt32()](#module_wscodec/io.Cursor+peekInt32) ⇒ <code>number</code>
            * [.readBytes(n)](#module_wscodec/io.Cursor+readBytes) ⇒ <code>Uint8Array</code>
            * [.readFString()](#module_wscodec/io.Cursor+readFString) ⇒ <code>FStringResult</code>
        * [.Writer](#module_wscodec/io.Writer)
            * [new exports.Writer([initialCapacity])](#new_module_wscodec/io.Writer_new)
            * [.pos()](#module_wscodec/io.Writer+pos) ⇒ <code>number</code>
            * [.finalize()](#module_wscodec/io.Writer+finalize) ⇒ <code>Uint8Array</code>
            * [.backpatchInt32(pos, value)](#module_wscodec/io.Writer+backpatchInt32)
            * [.writeUint8(v)](#module_wscodec/io.Writer+writeUint8)
            * [.writeInt8(v)](#module_wscodec/io.Writer+writeInt8)
            * [.writeUint16(v)](#module_wscodec/io.Writer+writeUint16)
            * [.writeInt16(v)](#module_wscodec/io.Writer+writeInt16)
            * [.writeUint32(v)](#module_wscodec/io.Writer+writeUint32)
            * [.writeInt32(v)](#module_wscodec/io.Writer+writeInt32)
            * [.writeUint64(v)](#module_wscodec/io.Writer+writeUint64)
            * [.writeInt64(v)](#module_wscodec/io.Writer+writeInt64)
            * [.writeFloat32(v)](#module_wscodec/io.Writer+writeFloat32)
            * [.writeFloat64(v)](#module_wscodec/io.Writer+writeFloat64)
            * [.writeBytes(u8)](#module_wscodec/io.Writer+writeBytes)
            * [.writeFString(value, [isUnicode], [isNull])](#module_wscodec/io.Writer+writeFString)
    * _inner_
        * [~FStringResult](#module_wscodec/io..FStringResult) : <code>Object</code>

<a name="module_wscodec/io.Cursor"></a>

### wscodec/io.Cursor
Read-only cursor over a Uint8Array. Tracks an offset and exposeslittle-endian primitive readers plus an FString reader. No Unrealsemantics; the property/struct/value classes layer on top.

**Kind**: static class of [<code>wscodec/io</code>](#module_wscodec/io)  

* [.Cursor](#module_wscodec/io.Cursor)
    * [new exports.Cursor(bytes, [offset])](#new_module_wscodec/io.Cursor_new)
    * [.pos()](#module_wscodec/io.Cursor+pos) ⇒ <code>number</code>
    * [.eof()](#module_wscodec/io.Cursor+eof) ⇒ <code>boolean</code>
    * [.remaining()](#module_wscodec/io.Cursor+remaining) ⇒ <code>number</code>
    * [.skip(n)](#module_wscodec/io.Cursor+skip)
    * [.seek(n)](#module_wscodec/io.Cursor+seek)
    * [.readUint8()](#module_wscodec/io.Cursor+readUint8) ⇒ <code>number</code>
    * [.readInt8()](#module_wscodec/io.Cursor+readInt8) ⇒ <code>number</code>
    * [.readUint16()](#module_wscodec/io.Cursor+readUint16) ⇒ <code>number</code>
    * [.readInt16()](#module_wscodec/io.Cursor+readInt16) ⇒ <code>number</code>
    * [.readUint32()](#module_wscodec/io.Cursor+readUint32) ⇒ <code>number</code>
    * [.readInt32()](#module_wscodec/io.Cursor+readInt32) ⇒ <code>number</code>
    * [.readUint64()](#module_wscodec/io.Cursor+readUint64) ⇒ <code>bigint</code>
    * [.readInt64()](#module_wscodec/io.Cursor+readInt64) ⇒ <code>bigint</code>
    * [.readFloat32()](#module_wscodec/io.Cursor+readFloat32) ⇒ <code>number</code>
    * [.readFloat64()](#module_wscodec/io.Cursor+readFloat64) ⇒ <code>number</code>
    * [.peekInt32()](#module_wscodec/io.Cursor+peekInt32) ⇒ <code>number</code>
    * [.readBytes(n)](#module_wscodec/io.Cursor+readBytes) ⇒ <code>Uint8Array</code>
    * [.readFString()](#module_wscodec/io.Cursor+readFString) ⇒ <code>FStringResult</code>

<a name="new_module_wscodec/io.Cursor_new"></a>

#### new exports.Cursor(bytes, [offset])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| bytes | <code>Uint8Array</code> |  | Backing buffer. Mutating the buffer mutates what subsequent reads see. |
| [offset] | <code>number</code> | <code>0</code> | Initial read position. |

<a name="module_wscodec/io.Cursor+pos"></a>

#### cursor.pos() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Current absolute offset.  
<a name="module_wscodec/io.Cursor+eof"></a>

#### cursor.eof() ⇒ <code>boolean</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>boolean</code> - True iff the cursor is at or past the end of the buffer.  
<a name="module_wscodec/io.Cursor+remaining"></a>

#### cursor.remaining() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Bytes remaining between the cursor and the end of the buffer.  
<a name="module_wscodec/io.Cursor+skip"></a>

#### cursor.skip(n)
Advance the cursor by `n` bytes. Use `seek(n)` to jump to an absoluteoffset (including backwards).

**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Throws**:

- <code>RangeError</code> If `n` is negative, non-finite, or would walk past the end of the buffer.


| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Non-negative byte count to advance. |

<a name="module_wscodec/io.Cursor+seek"></a>

#### cursor.seek(n)
Move the cursor to absolute offset `n`. The buffer's length is a legalvalue (the cursor is then at EOF; any further read throws).

**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Throws**:

- <code>RangeError</code> If `n` is non-finite or out of range.


| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Absolute offset in `[0, buffer.length]`. |

<a name="module_wscodec/io.Cursor+readUint8"></a>

#### cursor.readUint8() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Unsigned 8-bit byte.  
<a name="module_wscodec/io.Cursor+readInt8"></a>

#### cursor.readInt8() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Signed 8-bit byte.  
<a name="module_wscodec/io.Cursor+readUint16"></a>

#### cursor.readUint16() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Little-endian unsigned 16-bit integer.  
<a name="module_wscodec/io.Cursor+readInt16"></a>

#### cursor.readInt16() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Little-endian signed 16-bit integer.  
<a name="module_wscodec/io.Cursor+readUint32"></a>

#### cursor.readUint32() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Little-endian unsigned 32-bit integer.  
<a name="module_wscodec/io.Cursor+readInt32"></a>

#### cursor.readInt32() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Little-endian signed 32-bit integer.  
<a name="module_wscodec/io.Cursor+readUint64"></a>

#### cursor.readUint64() ⇒ <code>bigint</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>bigint</code> - Little-endian unsigned 64-bit integer as BigInt.  
<a name="module_wscodec/io.Cursor+readInt64"></a>

#### cursor.readInt64() ⇒ <code>bigint</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>bigint</code> - Little-endian signed 64-bit integer as BigInt.  
<a name="module_wscodec/io.Cursor+readFloat32"></a>

#### cursor.readFloat32() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Little-endian IEEE-754 single.  
<a name="module_wscodec/io.Cursor+readFloat64"></a>

#### cursor.readFloat64() ⇒ <code>number</code>
**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - Little-endian IEEE-754 double.  
<a name="module_wscodec/io.Cursor+peekInt32"></a>

#### cursor.peekInt32() ⇒ <code>number</code>
Peek a 4-byte little-endian int32 at the current position withoutadvancing the cursor. Used by ambiguity-resolving heuristics(property-stream tag sniffing, ObjectRef array-element guards) thatneed to look ahead before committing to a read.

**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>number</code> - The int32 value that `readInt32` would return.  
<a name="module_wscodec/io.Cursor+readBytes"></a>

#### cursor.readBytes(n) ⇒ <code>Uint8Array</code>
Read `n` bytes and return them as a Uint8Array VIEW over the underlyingbuffer (no copy). The returned subarray shares storage with this cursor'sbuffer: mutating it mutates the buffer, and the view becomes stale ifthe buffer is detached. Callers that need to retain the bytes past thebuffer's lifetime should `.slice()` the result.

**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>Uint8Array</code> - View over the next `n` bytes.  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Number of bytes to read. |

<a name="module_wscodec/io.Cursor+readFString"></a>

#### cursor.readFString() ⇒ <code>FStringResult</code>
Read an FString. Wire layout is:  int32 SaveNum (length in code units INCLUDING null terminator)    SaveNum > 0 -> ANSI;  SaveNum < 0 -> UTF-16 LE;  SaveNum == 0 -> empty.The wire distinguishes two flavors of empty (both decode to `""`):  SaveNum = 0         -> "null" form, no further bytes.  SaveNum = 1 (or -1) -> "empty-with-terminator", 1 ANSI byte (or 1                         UTF-16 code unit) follows; the NUL terminator.`isNull` on the returned record preserves which form was on the wire,so the writer can reproduce it byte-for-byte.

**Kind**: instance method of [<code>Cursor</code>](#module_wscodec/io.Cursor)  
**Returns**: <code>FStringResult</code> - Decoded string plus wire-flag metadata.  
<a name="module_wscodec/io.Writer"></a>

### wscodec/io.Writer
Append-only writer that grows its backing buffer as needed. Mirror of`Cursor` for the encode side; same little-endian primitives plus anFString writer and a back-patch helper for size-prefix fields.

**Kind**: static class of [<code>wscodec/io</code>](#module_wscodec/io)  

* [.Writer](#module_wscodec/io.Writer)
    * [new exports.Writer([initialCapacity])](#new_module_wscodec/io.Writer_new)
    * [.pos()](#module_wscodec/io.Writer+pos) ⇒ <code>number</code>
    * [.finalize()](#module_wscodec/io.Writer+finalize) ⇒ <code>Uint8Array</code>
    * [.backpatchInt32(pos, value)](#module_wscodec/io.Writer+backpatchInt32)
    * [.writeUint8(v)](#module_wscodec/io.Writer+writeUint8)
    * [.writeInt8(v)](#module_wscodec/io.Writer+writeInt8)
    * [.writeUint16(v)](#module_wscodec/io.Writer+writeUint16)
    * [.writeInt16(v)](#module_wscodec/io.Writer+writeInt16)
    * [.writeUint32(v)](#module_wscodec/io.Writer+writeUint32)
    * [.writeInt32(v)](#module_wscodec/io.Writer+writeInt32)
    * [.writeUint64(v)](#module_wscodec/io.Writer+writeUint64)
    * [.writeInt64(v)](#module_wscodec/io.Writer+writeInt64)
    * [.writeFloat32(v)](#module_wscodec/io.Writer+writeFloat32)
    * [.writeFloat64(v)](#module_wscodec/io.Writer+writeFloat64)
    * [.writeBytes(u8)](#module_wscodec/io.Writer+writeBytes)
    * [.writeFString(value, [isUnicode], [isNull])](#module_wscodec/io.Writer+writeFString)

<a name="new_module_wscodec/io.Writer_new"></a>

#### new exports.Writer([initialCapacity])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [initialCapacity] | <code>number</code> | <code>256</code> | Starting buffer size in bytes. The buffer doubles whenever a write would overflow. |

<a name="module_wscodec/io.Writer+pos"></a>

#### writer.pos() ⇒ <code>number</code>
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  
**Returns**: <code>number</code> - Current write offset (also the byte count emitted so far).  
<a name="module_wscodec/io.Writer+finalize"></a>

#### writer.finalize() ⇒ <code>Uint8Array</code>
Take a snapshot copy of the bytes written so far. The original buffermay continue to grow after this call without affecting the result.

**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  
**Returns**: <code>Uint8Array</code> - A standalone copy of the written bytes.  
<a name="module_wscodec/io.Writer+backpatchInt32"></a>

#### writer.backpatchInt32(pos, value)
Overwrite a 4-byte little-endian int32 at an absolute buffer positionrecorded earlier (via `pos()`). Used for tag-size back-patching: emitthe tag with a 0 placeholder, write the value bytes (which may growthe buffer), then patch in the actual size. Resizing the bufferpreserves the prefix bytes, so an earlier-captured position staysvalid through any number of intervening writes.

**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| pos | <code>number</code> | Absolute byte offset captured earlier via `pos()`. |
| value | <code>number</code> | Int32 to write (coerced via `| 0`). |

<a name="module_wscodec/io.Writer+writeUint8"></a>

#### writer.writeUint8(v)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>number</code> | Unsigned 8-bit byte. |

<a name="module_wscodec/io.Writer+writeInt8"></a>

#### writer.writeInt8(v)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>number</code> | Signed 8-bit byte. |

<a name="module_wscodec/io.Writer+writeUint16"></a>

#### writer.writeUint16(v)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>number</code> | Little-endian unsigned 16-bit integer. |

<a name="module_wscodec/io.Writer+writeInt16"></a>

#### writer.writeInt16(v)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>number</code> | Little-endian signed 16-bit integer. |

<a name="module_wscodec/io.Writer+writeUint32"></a>

#### writer.writeUint32(v)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>number</code> | Little-endian unsigned 32-bit integer. |

<a name="module_wscodec/io.Writer+writeInt32"></a>

#### writer.writeInt32(v)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>number</code> | Little-endian signed 32-bit integer. |

<a name="module_wscodec/io.Writer+writeUint64"></a>

#### writer.writeUint64(v)
Write a 64-bit unsigned integer. Accepts BigInt, a decimal string, or asafe-integer Number (|v| <= Number.MAX_SAFE_INTEGER = 2^53 - 1). A Numberoutside that range throws RangeError rather than silently losing precisionvia `BigInt(largeNumber)`. The codec's decoders return I64/U64 values asstrings for this reason; this guard catches accidental mutation thatsubstitutes an unsafe Number.

**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  
**Throws**:

- <code>RangeError</code> If `v` is a Number outside the safe-integer range.
- <code>TypeError</code> If `v` is some other type.


| Param | Type | Description |
| --- | --- | --- |
| v | <code>bigint</code> \| <code>string</code> \| <code>number</code> | Value to encode. |

<a name="module_wscodec/io.Writer+writeInt64"></a>

#### writer.writeInt64(v)
Signed 64-bit integer. See `writeUint64` for accepted value forms and errors.

**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>bigint</code> \| <code>string</code> \| <code>number</code> | Value to encode. |

<a name="module_wscodec/io.Writer+writeFloat32"></a>

#### writer.writeFloat32(v)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>number</code> | Little-endian IEEE-754 single. |

<a name="module_wscodec/io.Writer+writeFloat64"></a>

#### writer.writeFloat64(v)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>number</code> | Little-endian IEEE-754 double. |

<a name="module_wscodec/io.Writer+writeBytes"></a>

#### writer.writeBytes(u8)
**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Description |
| --- | --- | --- |
| u8 | <code>Uint8Array</code> | Raw bytes to append verbatim. |

<a name="module_wscodec/io.Writer+writeFString"></a>

#### writer.writeFString(value, [isUnicode], [isNull])
Write an FString. The `isNull` parameter only matters when `value` isthe empty string (or `null`/`undefined`); for non-empty strings thewire form is unambiguous.  value = null/undefined         -> SaveNum = 0 (null form)  value = ''  and isNull truthy  -> SaveNum = 0 (null form)  value = ''  and isNull false   -> SaveNum = 1/-1 (empty-with-terminator)  value = ''  and isNull null    -> SaveNum = 0 (default; matches prior behavior)  value = 'x' (any non-empty)    -> SaveNum encodes content`isUnicode` is auto-detected from the content when not supplied. Foran empty-with-terminator string the caller picks the encoding via`isUnicode` (defaults to ANSI).

**Kind**: instance method of [<code>Writer</code>](#module_wscodec/io.Writer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| value | <code>string</code> \| <code>null</code> \| <code>undefined</code> |  | String content. `null`/`undefined` writes the null form. |
| [isUnicode] | <code>boolean</code> \| <code>null</code> | <code></code> | Explicit encoding. `null` auto-detects from content. |
| [isNull] | <code>boolean</code> \| <code>null</code> | <code></code> | Explicit empty-form selection. See table above. |

<a name="module_wscodec/io..FStringResult"></a>

### wscodec/io~FStringResult : <code>Object</code>
FString decode result. Carries the decoded JS string plus the two wireflags needed to round-trip byte-identically: which encoding produced it,and whether the wire used the null-form (SaveNum=0) vs. theempty-with-terminator form (SaveNum=±1).

**Kind**: inner typedef of [<code>wscodec/io</code>](#module_wscodec/io)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| value | <code>string</code> | Decoded string (may be empty). |
| isUnicode | <code>boolean</code> | True if the wire form was UTF-16 LE. |
| isNull | <code>boolean</code> | True if the wire SaveNum was 0 (null form). |
