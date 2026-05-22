/**
 * FName and FGuid: the two pervasive identifier types in UE serialization.
 *
 * Soulmask's quirk for FName: the property-stream wire form is a plain
 * FString (no trailing FName.Number int32). Stock UE 4.27 serializes FName
 * inside a property tag as FString + int32 Number; Soulmask drops the int32
 * everywhere except the OUTERMOST None terminator (which still carries a
 * 4-byte FName.Number = 0 trailer, handled by the property-stream reader).
 *
 * `FName.read` / instance `write` therefore use the Soulmask form (bare
 * FString). The full UE form is exposed separately as `FName.readWithNumber`
 * / instance `writeWithNumber`: not used by Soulmask today, but wired up so
 * the codec can speak the standard wire format if the game's serializer ever
 * adopts it.
 */

const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

export class FName {
  constructor(value, { isUnicode = false, number = 0, isNull = false } = {}) {
    this.value = value;
    this.isUnicode = isUnicode;
    // FName.Number: zero in every observed Soulmask FName (the wire form
    // omits it). Preserved on the instance for round-trip when the full UE
    // form is used via readWithNumber/writeWithNumber.
    this.number = number;
    // Tracks the wire-form distinction between an FString with SaveNum=0
    // (the "null" form) and SaveNum=1 (empty-with-terminator). Only ever
    // meaningful when `value === ''`; for non-empty FNames this stays
    // false and is ignored on write.
    this.isNull = isNull;
  }
  toString() { return this.value; }
  /** JSON-friendly form: the bare name string (drops isUnicode/number/isNull metadata). */
  toJSON() { return this.value; }

  /**
   * Read an FName in the Soulmask property-stream form: a bare FString,
   * no trailing FName.Number. `number` is left at 0.
   */
  static read(cursor) {
    const s = cursor.readFString();
    return new FName(s.value, { isUnicode: s.isUnicode, isNull: !!s.isNull });
  }

  /** Write the Soulmask form (FString only). */
  write(writer) { writer.writeFString(this.value, this.isUnicode, this.isNull); }

  /**
   * Read an FName in the stock UE 4.27 property-tag form: FString + int32
   * Number. Use this if you're decoding a non-Soulmask stream or a future
   * Soulmask wire format that re-adopts the int32 suffix.
   */
  static readWithNumber(cursor) {
    const s = cursor.readFString();
    const number = cursor.readInt32();
    return new FName(s.value, { isUnicode: s.isUnicode, isNull: !!s.isNull, number });
  }

  /** Write the stock UE form (FString + int32 Number). */
  writeWithNumber(writer) {
    writer.writeFString(this.value, this.isUnicode, this.isNull);
    writer.writeInt32(this.number | 0);
  }

  /** Accepts an FName, a bare string, or a plain {value,isUnicode,isNull,number} record. */
  static from(x) {
    if (x instanceof FName) return x;
    if (typeof x === 'string') return new FName(x);
    if (x && typeof x === 'object') {
      return new FName(x.value, {
        isUnicode: !!x.isUnicode,
        number: x.number || 0,
        isNull: !!x.isNull,
      });
    }
    throw new Error('FName.from: unsupported value ' + typeof x);
  }
}

export class FGuid {
  /** Stored as the canonical 8-4-4-4-12 hex string (uppercase). */
  constructor(value) { this.value = value; }
  toString() { return this.value; }

  /**
   * JSON-friendly form: the bare GUID string, so `JSON.stringify(fguid)`
   * yields `"AABBCCDD-..."` rather than `{"value":"AABBCCDD-..."}`.
   */
  toJSON() { return this.value; }

  /**
   * Structural equality. Case-insensitive: an FGuid constructed from a
   * lowercase string compares equal to one read off the wire (uppercase).
   * Accepts an FGuid or a string; anything else returns false.
   */
  equals(other) {
    const otherStr = other instanceof FGuid ? other.value
                   : typeof other === 'string' ? other
                   : null;
    if (otherStr == null) return false;
    return String(this.value).toUpperCase() === otherStr.toUpperCase();
  }

  /** True iff the GUID is all zeros (the conventional null-GUID sentinel). */
  isZero() { return String(this.value).toUpperCase() === ZERO_GUID; }

  /** All-zero FGuid sentinel. New instance per call (FGuid is mutable). */
  static zero() { return new FGuid(ZERO_GUID); }

  static read(cursor) {
    const A = cursor.readUint32(), B = cursor.readUint32(), C = cursor.readUint32(), D = cursor.readUint32();
    const h = (n, w) => n.toString(16).padStart(w, '0').toUpperCase();
    return new FGuid(`${h(A, 8)}-${h(B >>> 16, 4)}-${h(B & 0xFFFF, 4)}-${h(C >>> 16, 4)}-${h(C & 0xFFFF, 4)}${h(D, 8)}`);
  }

  write(writer) {
    const m = String(this.value).match(/^([0-9A-Fa-f]{8})-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{4})([0-9A-Fa-f]{8})$/);
    if (!m) throw new Error(`FGuid.write: invalid FGuid string '${this.value}'`);
    const A = parseInt(m[1], 16);
    const B = (parseInt(m[2], 16) << 16) | parseInt(m[3], 16);
    const C = (parseInt(m[4], 16) << 16) | parseInt(m[5], 16);
    const D = parseInt(m[6], 16);
    writer.writeUint32(A); writer.writeUint32(B); writer.writeUint32(C); writer.writeUint32(D);
  }

  /** Accepts an FGuid or a canonical 8-4-4-4-12 hex string. */
  static from(x) {
    if (x instanceof FGuid) return x;
    if (typeof x === 'string') return new FGuid(x);
    throw new Error('FGuid.from: unsupported value ' + typeof x);
  }
}
