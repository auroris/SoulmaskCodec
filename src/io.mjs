/**
 * Cursor + Writer: byte-level read/write primitives over a Uint8Array.
 *
 * No Unreal semantics here. FString lives here too because it's a stateful
 * read/write on the same DataView; everything else (FName, FGuid, structs,
 * properties) builds on top of these.
 *
 * @module wscodec/io
 */

/**
 * FString decode result. Carries the decoded JS string plus the two wire
 * flags needed to round-trip byte-identically: which encoding produced it,
 * and whether the wire used the null-form (SaveNum=0) vs. the
 * empty-with-terminator form (SaveNum=±1).
 *
 * @typedef {Object} FStringResult
 * @property {string} value - Decoded string (may be empty).
 * @property {boolean} isUnicode - True if the wire form was UTF-16 LE.
 * @property {boolean} isNull - True if the wire SaveNum was 0 (null form).
 */

// Module-scope decoders so we pay the construction cost once per process.
// `latin1` maps bytes 0-255 onto code points 0-255 identically, matching the
// historical char-by-char `String.fromCharCode(byte)` loop. `utf-16le` matches
// the UE wire encoding for non-ANSI FStrings.
const _LATIN1_DECODER  = new TextDecoder('latin1');
const _UTF16LE_DECODER = new TextDecoder('utf-16le');

/**
 * Read-only cursor over a Uint8Array. Tracks an offset and exposes
 * little-endian primitive readers plus an FString reader. No Unreal
 * semantics; the property/struct/value classes layer on top.
 */
export class Cursor {
  /**
   * @param {Uint8Array} bytes - Backing buffer. Mutating the buffer mutates what subsequent reads see.
   * @param {number} [offset=0] - Initial read position.
   */
  constructor(bytes, offset = 0) {
    this.bytes = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = offset;
  }

  /** @returns {number} Current absolute offset. */
  pos()       { return this.offset; }

  /** @returns {boolean} True iff the cursor is at or past the end of the buffer. */
  eof()       { return this.offset >= this.bytes.length; }

  /** @returns {number} Bytes remaining between the cursor and the end of the buffer. */
  remaining() { return this.bytes.length - this.offset; }

  /**
   * Advance the cursor by `n` bytes. Use `seek(n)` to jump to an absolute
   * offset (including backwards).
   *
   * @param {number} n - Non-negative byte count to advance.
   * @throws {RangeError} If `n` is negative, non-finite, or would walk past the end of the buffer.
   */
  skip(n) {
    if (!Number.isFinite(n) || n < 0) {
      throw new RangeError(`Cursor.skip: n must be a non-negative finite number, got ${n}`);
    }
    if (this.offset + n > this.bytes.length) {
      throw new RangeError(`Cursor.skip: ${n} bytes from offset ${this.offset} exceeds buffer length ${this.bytes.length}`);
    }
    this.offset += n;
  }

  /**
   * Move the cursor to absolute offset `n`. The buffer's length is a legal
   * value (the cursor is then at EOF; any further read throws).
   *
   * @param {number} n - Absolute offset in `[0, buffer.length]`.
   * @throws {RangeError} If `n` is non-finite or out of range.
   */
  seek(n) {
    if (!Number.isFinite(n) || n < 0 || n > this.bytes.length) {
      throw new RangeError(`Cursor.seek: offset ${n} out of range [0, ${this.bytes.length}]`);
    }
    this.offset = n;
  }

  /** @returns {number} Unsigned 8-bit byte. */
  readUint8()   { const v = this.dv.getUint8(this.offset);            this.offset += 1; return v; }
  /** @returns {number} Signed 8-bit byte. */
  readInt8()    { const v = this.dv.getInt8(this.offset);             this.offset += 1; return v; }
  /** @returns {number} Little-endian unsigned 16-bit integer. */
  readUint16()  { const v = this.dv.getUint16(this.offset, true);     this.offset += 2; return v; }
  /** @returns {number} Little-endian signed 16-bit integer. */
  readInt16()   { const v = this.dv.getInt16(this.offset, true);      this.offset += 2; return v; }
  /** @returns {number} Little-endian unsigned 32-bit integer. */
  readUint32()  { const v = this.dv.getUint32(this.offset, true);     this.offset += 4; return v; }
  /** @returns {number} Little-endian signed 32-bit integer. */
  readInt32()   { const v = this.dv.getInt32(this.offset, true);      this.offset += 4; return v; }
  /** @returns {bigint} Little-endian unsigned 64-bit integer as BigInt. */
  readUint64()  { const v = this.dv.getBigUint64(this.offset, true);  this.offset += 8; return v; }
  /** @returns {bigint} Little-endian signed 64-bit integer as BigInt. */
  readInt64()   { const v = this.dv.getBigInt64(this.offset, true);   this.offset += 8; return v; }
  /** @returns {number} Little-endian IEEE-754 single. */
  readFloat32() { const v = this.dv.getFloat32(this.offset, true);    this.offset += 4; return v; }
  /** @returns {number} Little-endian IEEE-754 double. */
  readFloat64() { const v = this.dv.getFloat64(this.offset, true);    this.offset += 8; return v; }

  /**
   * Peek a 4-byte little-endian int32 at the current position without
   * advancing the cursor. Used by ambiguity-resolving heuristics
   * (property-stream tag sniffing, ObjectRef array-element guards) that
   * need to look ahead before committing to a read.
   *
   * @returns {number} The int32 value that `readInt32` would return.
   */
  peekInt32()  { return this.dv.getInt32(this.offset, true); }

  /**
   * Read `n` bytes and return them as a Uint8Array VIEW over the underlying
   * buffer (no copy). The returned subarray shares storage with this cursor's
   * buffer: mutating it mutates the buffer, and the view becomes stale if
   * the buffer is detached. Callers that need to retain the bytes past the
   * buffer's lifetime should `.slice()` the result.
   *
   * @param {number} n - Number of bytes to read.
   * @returns {Uint8Array} View over the next `n` bytes.
   */
  readBytes(n)  { const out = this.bytes.subarray(this.offset, this.offset + n); this.offset += n; return out; }

  /**
   * Read an FString. Wire layout is:
   *
   *   int32 SaveNum (length in code units INCLUDING null terminator)
   *     SaveNum > 0 -> ANSI;  SaveNum < 0 -> UTF-16 LE;  SaveNum == 0 -> empty.
   *
   * The wire distinguishes two flavors of empty (both decode to `""`):
   *
   *   SaveNum = 0         -> "null" form, no further bytes.
   *   SaveNum = 1 (or -1) -> "empty-with-terminator", 1 ANSI byte (or 1
   *                          UTF-16 code unit) follows; the NUL terminator.
   *
   * `isNull` on the returned record preserves which form was on the wire,
   * so the writer can reproduce it byte-for-byte.
   *
   * @returns {FStringResult} Decoded string plus wire-flag metadata.
   */
  readFString() {
    const saveNum = this.readInt32();
    if (saveNum === 0) return { value: '', isUnicode: false, isNull: true };
    const isUnicode = saveNum < 0;
    const codeUnits = isUnicode ? -saveNum : saveNum;
    const byteLen = isUnicode ? codeUnits * 2 : codeUnits;
    const slice = this.readBytes(byteLen);
    const data = isUnicode ? slice.subarray(0, byteLen - 2) : slice.subarray(0, byteLen - 1);
    const value = isUnicode ? _UTF16LE_DECODER.decode(data) : _LATIN1_DECODER.decode(data);
    return { value, isUnicode, isNull: false };
  }
}

/**
 * Append-only writer that grows its backing buffer as needed. Mirror of
 * `Cursor` for the encode side; same little-endian primitives plus an
 * FString writer and a back-patch helper for size-prefix fields.
 */
export class Writer {
  /**
   * @param {number} [initialCapacity=256] - Starting buffer size in bytes. The buffer doubles whenever a write would overflow.
   */
  constructor(initialCapacity = 256) {
    this.buffer = new ArrayBuffer(initialCapacity);
    this.bytes = new Uint8Array(this.buffer);
    this.dv = new DataView(this.buffer);
    this.offset = 0;
  }

  /** @returns {number} Current write offset (also the byte count emitted so far). */
  pos() { return this.offset; }

  /**
   * Take a snapshot copy of the bytes written so far. The original buffer
   * may continue to grow after this call without affecting the result.
   *
   * @returns {Uint8Array} A standalone copy of the written bytes.
   */
  finalize() { return this.bytes.slice(0, this.offset); }

  _ensure(n) {
    if (this.offset + n <= this.buffer.byteLength) return;
    let cap = this.buffer.byteLength;
    while (cap < this.offset + n) cap *= 2;
    const newBuf = new ArrayBuffer(cap);
    const newU8 = new Uint8Array(newBuf);
    newU8.set(this.bytes.subarray(0, this.offset));
    this.buffer = newBuf;
    this.bytes = newU8;
    this.dv = new DataView(newBuf);
  }

  /**
   * Overwrite a 4-byte little-endian int32 at an absolute buffer position
   * recorded earlier (via `pos()`). Used for tag-size back-patching: emit
   * the tag with a 0 placeholder, write the value bytes (which may grow
   * the buffer), then patch in the actual size. Resizing the buffer
   * preserves the prefix bytes, so an earlier-captured position stays
   * valid through any number of intervening writes.
   *
   * @param {number} pos - Absolute byte offset captured earlier via `pos()`.
   * @param {number} value - Int32 to write (coerced via `| 0`).
   */
  backpatchInt32(pos, value) { this.dv.setInt32(pos, value | 0, true); }

  /** @param {number} v - Unsigned 8-bit byte. */
  writeUint8(v)   { this._ensure(1); this.dv.setUint8(this.offset, v);              this.offset += 1; }
  /** @param {number} v - Signed 8-bit byte. */
  writeInt8(v)    { this._ensure(1); this.dv.setInt8(this.offset, v);               this.offset += 1; }
  /** @param {number} v - Little-endian unsigned 16-bit integer. */
  writeUint16(v)  { this._ensure(2); this.dv.setUint16(this.offset, v, true);       this.offset += 2; }
  /** @param {number} v - Little-endian signed 16-bit integer. */
  writeInt16(v)   { this._ensure(2); this.dv.setInt16(this.offset, v, true);        this.offset += 2; }
  /** @param {number} v - Little-endian unsigned 32-bit integer. */
  writeUint32(v)  { this._ensure(4); this.dv.setUint32(this.offset, v >>> 0, true); this.offset += 4; }
  /** @param {number} v - Little-endian signed 32-bit integer. */
  writeInt32(v)   { this._ensure(4); this.dv.setInt32(this.offset, v | 0, true);    this.offset += 4; }

  /**
   * Write a 64-bit unsigned integer. Accepts BigInt, a decimal string, or a
   * safe-integer Number (|v| <= Number.MAX_SAFE_INTEGER = 2^53 - 1). A Number
   * outside that range throws RangeError rather than silently losing precision
   * via `BigInt(largeNumber)`. The codec's decoders return I64/U64 values as
   * strings for this reason; this guard catches accidental mutation that
   * substitutes an unsafe Number.
   *
   * @param {bigint|string|number} v - Value to encode.
   * @throws {RangeError} If `v` is a Number outside the safe-integer range.
   * @throws {TypeError} If `v` is some other type.
   */
  writeUint64(v)  { this._ensure(8); this.dv.setBigUint64(this.offset, _toBigInt64(v, 'Writer.writeUint64'), true); this.offset += 8; }

  /**
   * Signed 64-bit integer. See `writeUint64` for accepted value forms and errors.
   *
   * @param {bigint|string|number} v - Value to encode.
   */
  writeInt64(v)   { this._ensure(8); this.dv.setBigInt64(this.offset, _toBigInt64(v, 'Writer.writeInt64'), true); this.offset += 8; }

  /** @param {number} v - Little-endian IEEE-754 single. */
  writeFloat32(v) { this._ensure(4); this.dv.setFloat32(this.offset, v, true);      this.offset += 4; }
  /** @param {number} v - Little-endian IEEE-754 double. */
  writeFloat64(v) { this._ensure(8); this.dv.setFloat64(this.offset, v, true);      this.offset += 8; }
  /** @param {Uint8Array} u8 - Raw bytes to append verbatim. */
  writeBytes(u8)  { this._ensure(u8.length); this.bytes.set(u8, this.offset);       this.offset += u8.length; }

  /**
   * Write an FString. The `isNull` parameter only matters when `value` is
   * the empty string (or `null`/`undefined`); for non-empty strings the
   * wire form is unambiguous.
   *
   *   value = null/undefined         -> SaveNum = 0 (null form)
   *   value = ''  and isNull truthy  -> SaveNum = 0 (null form)
   *   value = ''  and isNull false   -> SaveNum = 1/-1 (empty-with-terminator)
   *   value = ''  and isNull null    -> SaveNum = 0 (default; matches prior behavior)
   *   value = 'x' (any non-empty)    -> SaveNum encodes content
   *
   * `isUnicode` is auto-detected from the content when not supplied. For
   * an empty-with-terminator string the caller picks the encoding via
   * `isUnicode` (defaults to ANSI).
   *
   * @param {string|null|undefined} value - String content. `null`/`undefined` writes the null form.
   * @param {boolean|null} [isUnicode=null] - Explicit encoding. `null` auto-detects from content.
   * @param {boolean|null} [isNull=null] - Explicit empty-form selection. See table above.
   */
  writeFString(value, isUnicode = null, isNull = null) {
    // Null form: no payload bytes.
    if (value == null || (value === '' && isNull !== false)) {
      this.writeInt32(0);
      return;
    }
    // Auto-detect encoding for non-empty content. Empty-with-terminator
    // keeps whatever the caller passed (default ANSI).
    if (isUnicode === null) {
      isUnicode = false;
      for (let i = 0; i < value.length; i++) {
        if (value.charCodeAt(i) >= 0x80) { isUnicode = true; break; }
      }
    }
    if (isUnicode) {
      const len = value.length + 1;
      this.writeInt32(-len);
      this._ensure(len * 2);
      for (let i = 0; i < value.length; i++) {
        this.dv.setUint16(this.offset + i * 2, value.charCodeAt(i), true);
      }
      this.dv.setUint16(this.offset + value.length * 2, 0, true);
      this.offset += len * 2;
    } else {
      const len = value.length + 1;
      this.writeInt32(len);
      this._ensure(len);
      for (let i = 0; i < value.length; i++) this.bytes[this.offset + i] = value.charCodeAt(i);
      this.bytes[this.offset + value.length] = 0;
      this.offset += len;
    }
  }
}

/**
 * Coerce a 64-bit integer value into a BigInt suitable for
 * DataView.setBig{Int,Uint}64. Accepts BigInt directly; converts string and
 * safe-integer Number; throws on unsafe Number or unsupported types.
 *
 * The motivation: `BigInt(largeNumber)` silently loses precision for
 * |v| > 2^53. The decoder paths return I64/U64 values as decimal strings
 * specifically to avoid this; tightening the writer's contract catches
 * accidental round-trip-breaking mutation at the source.
 *
 * @private
 * @param {bigint|string|number} v - Value to convert.
 * @param {string} fnName - Caller name used in error messages.
 * @returns {bigint} The coerced BigInt.
 * @throws {RangeError|TypeError} On unsafe Number or unsupported types.
 */
function _toBigInt64(v, fnName) {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'string')  return BigInt(v);
  if (typeof v === 'number') {
    if (Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER) return BigInt(v);
    throw new RangeError(`${fnName}: Number ${v} is unsafe for 64-bit conversion (non-integer or |v| > 2^53). Pass a BigInt or decimal string.`);
  }
  throw new TypeError(`${fnName}: expected BigInt, string, or safe-integer Number; got ${typeof v}`);
}
