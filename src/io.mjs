/**
 * Cursor + Writer: byte-level read/write primitives over a Uint8Array.
 *
 * No Unreal semantics here. FString lives here too because it's a stateful
 * read/write on the same DataView; everything else (FName, FGuid, structs,
 * properties) builds on top of these.
 */

// Module-scope decoders so we pay the construction cost once per process.
// `latin1` maps bytes 0-255 onto code points 0-255 identically, matching the
// historical char-by-char `String.fromCharCode(byte)` loop. `utf-16le` matches
// the UE wire encoding for non-ANSI FStrings.
const _LATIN1_DECODER  = new TextDecoder('latin1');
const _UTF16LE_DECODER = new TextDecoder('utf-16le');

/**
 * Decoded FString return shape.
 *
 * @typedef  {object}  FStringRead
 * @property {string}  value      Decoded string (empty for both null and empty-with-terminator forms).
 * @property {boolean} isUnicode  True if the wire form used UTF-16 LE (negative SaveNum).
 * @property {boolean} isNull     True if the wire form was SaveNum=0 (no payload) rather than empty-with-terminator.
 */

/**
 * Forward-only reader over a Uint8Array. All multi-byte integers are
 * little-endian. The cursor holds a direct DataView over the input bytes —
 * no copy — and advances `offset` on every read.
 */
export class Cursor {
  /**
   * @param {Uint8Array} bytes     Backing buffer. Mutating it after construction is visible to subsequent reads.
   * @param {number}     [offset] Starting absolute offset (default 0).
   */
  constructor(bytes, offset = 0) {
    this.bytes = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = offset;
  }
  /** Current absolute offset within the buffer. */
  pos()       { return this.offset; }
  /** True iff the cursor is at or past the end of the buffer. */
  eof()       { return this.offset >= this.bytes.length; }
  /** Bytes remaining between the cursor and the end of the buffer. */
  remaining() { return this.bytes.length - this.offset; }

  /**
   * Advance the cursor by `n` bytes. Throws RangeError if `n` is negative or
   * would take the cursor past the end of the buffer. Use `seek(n)` to jump
   * to an absolute offset (including backwards).
   *
   * @param {number} n  Non-negative number of bytes to skip.
   * @throws {RangeError}
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
   * Move the cursor to absolute offset `n`. Throws RangeError if `n` is out
   * of `[0, buffer.length]` (note: length is allowed; the cursor is then at
   * EOF and any further read would throw).
   *
   * @param {number} n  Absolute offset in `[0, buffer.length]`.
   * @throws {RangeError}
   */
  seek(n) {
    if (!Number.isFinite(n) || n < 0 || n > this.bytes.length) {
      throw new RangeError(`Cursor.seek: offset ${n} out of range [0, ${this.bytes.length}]`);
    }
    this.offset = n;
  }

  readUint8()   { const v = this.dv.getUint8(this.offset);            this.offset += 1; return v; }
  readInt8()    { const v = this.dv.getInt8(this.offset);             this.offset += 1; return v; }
  readUint16()  { const v = this.dv.getUint16(this.offset, true);     this.offset += 2; return v; }
  readInt16()   { const v = this.dv.getInt16(this.offset, true);      this.offset += 2; return v; }
  readUint32()  { const v = this.dv.getUint32(this.offset, true);     this.offset += 4; return v; }
  readInt32()   { const v = this.dv.getInt32(this.offset, true);      this.offset += 4; return v; }
  readUint64()  { const v = this.dv.getBigUint64(this.offset, true);  this.offset += 8; return v; }
  readInt64()   { const v = this.dv.getBigInt64(this.offset, true);   this.offset += 8; return v; }
  readFloat32() { const v = this.dv.getFloat32(this.offset, true);    this.offset += 4; return v; }
  readFloat64() { const v = this.dv.getFloat64(this.offset, true);    this.offset += 8; return v; }

  /**
   * Peek a 4-byte little-endian int32 at the current position without
   * advancing the cursor. Used by ambiguity-resolving heuristics
   * (property-stream tag sniffing, ObjectRef array-element guards) that
   * need to look ahead before committing to a read.
   */
  peekInt32()  { return this.dv.getInt32(this.offset, true); }

  /**
   * Read `n` bytes and return them as a Uint8Array VIEW over the underlying
   * buffer (no copy). The returned subarray shares storage with this cursor's
   * buffer: mutating it mutates the buffer, and the view becomes stale if
   * the buffer is detached. Callers that need to retain the bytes past the
   * buffer's lifetime should `.slice()` the result.
   *
   * @param {number} n  Number of bytes to read.
   * @returns {Uint8Array} Subarray view, length `n`.
   */
  readBytes(n)  { const out = this.bytes.subarray(this.offset, this.offset + n); this.offset += n; return out; }

  /**
   * FString:  int32 SaveNum  (length in code units INCLUDING null terminator)
   *           SaveNum > 0 → ANSI;  SaveNum < 0 → UTF-16 LE;  SaveNum == 0 → empty.
   *
   * The wire format distinguishes two flavors of empty:
   *   SaveNum =  0          → "null" form. No further bytes.
   *   SaveNum =  1 (or -1)  → "empty-with-terminator". 1 ANSI byte (or 1
   *                           UTF-16 unit) follows; both are the NUL
   *                           terminator. The decoded string is still "".
   *
   * Both produce the same JS value (""), but to round-trip byte-identical
   * we need to know which one was on the wire. That distinction lives in
   * `isNull` on the return value.
   *
   * @returns {FStringRead}
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
 * Forward-only writer that grows its backing buffer on demand. All multi-byte
 * integers are written little-endian. Internal callers capture the result of
 * `pos()` before reserving a length placeholder and later use
 * `backpatchInt32` to fill it in once the actual size is known.
 */
export class Writer {
  /**
   * @param {number} [initialCapacity]  Starting buffer size in bytes (default 256). Buffer doubles when exhausted.
   */
  constructor(initialCapacity = 256) {
    this.buffer = new ArrayBuffer(initialCapacity);
    this.bytes = new Uint8Array(this.buffer);
    this.dv = new DataView(this.buffer);
    this.offset = 0;
  }
  /** Current absolute write offset. Capture this before reserving a placeholder slot. */
  pos() { return this.offset; }
  /**
   * Snapshot the written bytes as a fresh Uint8Array. The writer can be
   * reused after this call but the returned buffer is independent.
   *
   * @returns {Uint8Array}
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
   * @param {number} pos    Absolute byte offset of the placeholder.
   * @param {number} value  Int32 value to write (`| 0` coerced).
   */
  backpatchInt32(pos, value) { this.dv.setInt32(pos, value | 0, true); }

  writeUint8(v)   { this._ensure(1); this.dv.setUint8(this.offset, v);              this.offset += 1; }
  writeInt8(v)    { this._ensure(1); this.dv.setInt8(this.offset, v);               this.offset += 1; }
  writeUint16(v)  { this._ensure(2); this.dv.setUint16(this.offset, v, true);       this.offset += 2; }
  writeInt16(v)   { this._ensure(2); this.dv.setInt16(this.offset, v, true);        this.offset += 2; }
  writeUint32(v)  { this._ensure(4); this.dv.setUint32(this.offset, v >>> 0, true); this.offset += 4; }
  writeInt32(v)   { this._ensure(4); this.dv.setInt32(this.offset, v | 0, true);    this.offset += 4; }

  /**
   * Write a 64-bit unsigned integer. Accepts BigInt, a decimal string, or a
   * safe-integer Number (|v| <= Number.MAX_SAFE_INTEGER = 2^53 - 1). A Number
   * outside that range throws RangeError rather than silently losing precision
   * via `BigInt(largeNumber)`. The codec's decoders return I64/U64 values as
   * strings for this reason; this guard catches accidental mutation that
   * substitutes an unsafe Number.
   *
   * @param {bigint|string|number} v
   * @throws {RangeError|TypeError}
   */
  writeUint64(v)  { this._ensure(8); this.dv.setBigUint64(this.offset, _toBigInt64(v, 'Writer.writeUint64'), true); this.offset += 8; }
  /**
   * Signed 64-bit integer. See {@link Writer.writeUint64} for accepted value forms.
   *
   * @param {bigint|string|number} v
   * @throws {RangeError|TypeError}
   */
  writeInt64(v)   { this._ensure(8); this.dv.setBigInt64(this.offset, _toBigInt64(v, 'Writer.writeInt64'), true); this.offset += 8; }
  writeFloat32(v) { this._ensure(4); this.dv.setFloat32(this.offset, v, true);      this.offset += 4; }
  writeFloat64(v) { this._ensure(8); this.dv.setFloat64(this.offset, v, true);      this.offset += 8; }
  /** @param {Uint8Array} u8  Bytes to append verbatim. */
  writeBytes(u8)  { this._ensure(u8.length); this.bytes.set(u8, this.offset);       this.offset += u8.length; }

  /**
   * Write an FString. The `isNull` parameter only matters when `value` is
   * the empty string (or `null`/`undefined`); for non-empty strings the
   * wire form is unambiguous.
   *
   *   value = null/undefined         → SaveNum = 0 (null form)
   *   value = ''  and isNull truthy  → SaveNum = 0 (null form)
   *   value = ''  and isNull false   → SaveNum = 1/-1 (empty-with-terminator)
   *   value = ''  and isNull null    → SaveNum = 0 (default; matches prior behavior)
   *   value = 'x' (any non-empty)    → SaveNum encodes content
   *
   * `isUnicode` is auto-detected from the content when not supplied. For
   * an empty-with-terminator string the caller picks the encoding via
   * `isUnicode` (defaults to ANSI).
   *
   * @param {string|null|undefined} value
   * @param {boolean|null} [isUnicode]  Force ANSI/UTF-16; null = auto-detect from content.
   * @param {boolean|null} [isNull]     For empty `value` only: pick null vs. empty-with-terminator form.
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
 * @internal
 * @param {bigint|string|number} v
 * @param {string} fnName  Caller name for error messages.
 * @returns {bigint}
 * @throws {RangeError|TypeError}
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
