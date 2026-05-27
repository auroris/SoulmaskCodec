/**
 * Leaf property types: primitives whose value is a single number, bool,
 * string, or FName. No nested decoding, no per-type wire quirks beyond
 * what `Cursor`/`Writer` already provide.
 *
 * The nine numeric leaves are generated from `NUMERIC_LEAVES`; the
 * less-uniform ones (Bool, Str, Name, Byte, Enum) are hand-written
 * because each has a distinct twist (tag-stored value, isNull/isUnicode
 * wire flags, dual form, FName coercion).
 *
 * The exported `IntProperty`, `Int8Property`, ..., `DoubleProperty` are
 * concrete subclasses of `Property`. Each one's `value` field holds the
 * decoded number (or decimal string for 64-bit integers).
 *
 * @module wscodec/properties/leaf
 */

import { Property, registerProperty } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { FName } from '../primitives.mjs';

// ── Numeric leaves ──────────────────────────────────────────────────────────
//
// 64-bit integers are exchanged as decimal strings throughout the codec to
// avoid JavaScript Number precision loss above 2^53; `Writer.writeInt64`
// accepts string/BigInt/safe-integer-Number with the same contract.

const NUMERIC_LEAVES = {
  IntProperty:    { read: c => c.readInt32(),               write: (w, v) => w.writeInt32(v),   default: 0,   fromJSON: j => j },
  Int8Property:   { read: c => c.readInt8(),                write: (w, v) => w.writeInt8(v),    default: 0,   fromJSON: j => j },
  Int16Property:  { read: c => c.readInt16(),               write: (w, v) => w.writeInt16(v),   default: 0,   fromJSON: j => j },
  Int64Property:  { read: c => c.readInt64().toString(),    write: (w, v) => w.writeInt64(v),   default: '0', fromJSON: j => String(j) },
  UInt16Property: { read: c => c.readUint16(),              write: (w, v) => w.writeUint16(v),  default: 0,   fromJSON: j => j },
  UInt32Property: { read: c => c.readUint32(),              write: (w, v) => w.writeUint32(v),  default: 0,   fromJSON: j => j },
  UInt64Property: { read: c => c.readUint64().toString(),   write: (w, v) => w.writeUint64(v),  default: '0', fromJSON: j => String(j) },
  FloatProperty:  { read: c => c.readFloat32(),             write: (w, v) => w.writeFloat32(v), default: 0,   fromJSON: j => j },
  DoubleProperty: { read: c => c.readFloat64(),             write: (w, v) => w.writeFloat64(v), default: 0,   fromJSON: j => j },
};

function defineNumericLeaf(name, spec) {
  const Cls = class extends Property {
    constructor({ tag, value = spec.default } = {}) {
      super({ tag });
      this.value = value;
    }
    static fromReader(cursor, tag) { return new Cls({ tag, value: spec.read(cursor) }); }
    _writeValue(w) { spec.write(w, this.value); }
    _writeJSON(j) { j.value = this.value; }
    static fromJSON(j) {
      return new Cls({ tag: PropertyTag.fromJSON(j), value: spec.fromJSON(j.value) });
    }
  };
  // Anonymize away the generic "Cls" so debugging / .constructor.name /
  // instanceof error messages name the actual property type.
  Object.defineProperty(Cls, 'name', { value: name });
  registerProperty(name, Cls);
  return Cls;
}

export const IntProperty    = defineNumericLeaf('IntProperty',    NUMERIC_LEAVES.IntProperty);
export const Int8Property   = defineNumericLeaf('Int8Property',   NUMERIC_LEAVES.Int8Property);
export const Int16Property  = defineNumericLeaf('Int16Property',  NUMERIC_LEAVES.Int16Property);
export const Int64Property  = defineNumericLeaf('Int64Property',  NUMERIC_LEAVES.Int64Property);
export const UInt16Property = defineNumericLeaf('UInt16Property', NUMERIC_LEAVES.UInt16Property);
export const UInt32Property = defineNumericLeaf('UInt32Property', NUMERIC_LEAVES.UInt32Property);
export const UInt64Property = defineNumericLeaf('UInt64Property', NUMERIC_LEAVES.UInt64Property);
export const FloatProperty  = defineNumericLeaf('FloatProperty',  NUMERIC_LEAVES.FloatProperty);
export const DoubleProperty = defineNumericLeaf('DoubleProperty', NUMERIC_LEAVES.DoubleProperty);

// ── BoolProperty ────────────────────────────────────────────────────────────
//
// The value lives on tag.boolVal (the wire stores it in the tag itself, no
// payload bytes follow). `Property.toBytes` writes the tag with size=0 and
// the empty value buffer, so the boolVal byte is in the tag bytes. The
// `value` accessor is a getter/setter over tag.boolVal so the two can't go
// stale relative to each other.

/**
 * Boolean leaf property. The value is stored on the tag itself (`tag.boolVal`);
 * no payload bytes follow the tag on the wire.
 */
export class BoolProperty extends Property {
  /**
   * @param {Object} [fields]
   * @param {PropertyTag} [fields.tag]
   * @param {boolean} [fields.value=false]
   */
  constructor({ tag, value = false } = {}) {
    super({ tag });
    if (tag) tag.boolVal = value ? 1 : 0;
  }
  get value()  { return this.tag?.boolVal !== 0; }
  set value(v) { if (this.tag) this.tag.boolVal = v ? 1 : 0; }

  static fromReader(_cursor, tag) {
    return new BoolProperty({ tag, value: tag.boolVal !== 0 });
  }
  _writeValue(_w) { /* value lives in the tag */ }
  // boolVal is already emitted by tag.toJSON() via TAG_EXTRAS.BoolProperty —
  // only the redundant `value` boolean needs to be added here.
  _writeJSON(j) { j.value = this.value; }
  static fromJSON(j) {
    const tag = PropertyTag.fromJSON(j);
    // Tolerate JSON that carried only `value` (no explicit `boolVal`); the
    // common case is fully covered by tag.fromJSON above.
    if (j.boolVal == null) tag.boolVal = j.value ? 1 : 0;
    return new BoolProperty({ tag, value: !!j.value });
  }
}
registerProperty('BoolProperty', BoolProperty);

// ── StrProperty ─────────────────────────────────────────────────────────────

/**
 * String leaf. Carries `isUnicode` and `isNull` flags so the FString wire
 * encoding (ANSI vs UTF-16, null-form vs empty-with-terminator) round-trips
 * byte-identically.
 */
export class StrProperty extends Property {
  /**
   * @param {Object} [fields]
   * @param {PropertyTag} [fields.tag]
   * @param {string} [fields.value=''] - Decoded string.
   * @param {boolean} [fields.isNull=false] - Empty-value wire-form selector.
   * @param {boolean|null} [fields.isUnicode=null] - Explicit wire encoding; null auto-detects.
   */
  constructor({ tag, value = '', isNull = false, isUnicode = null } = {}) {
    super({ tag });
    this.value = value;
    // `isNull` distinguishes wire null-form (SaveNum=0, 4 B) from
    // empty-with-terminator (SaveNum=±1) — only meaningful when value === ''.
    this.isNull = isNull;
    this.isUnicode = isUnicode;
  }
  static fromReader(cursor, tag) {
    const fs = cursor.readFString();
    return new StrProperty({ tag, value: fs.value, isNull: !!fs.isNull, isUnicode: fs.isUnicode });
  }
  _writeValue(w) { w.writeFString(this.value, this.isUnicode, this.isNull); }
  _writeJSON(j) {
    j.value = this.value;
    if (this.isNull) j.isNull = true;
    if (this.isUnicode) j.isUnicode = true;
  }
  static fromJSON(j) {
    return new StrProperty({
      tag: PropertyTag.fromJSON(j),
      value: j.value ?? '',
      isNull: !!j.isNull,
      // Preserve "missing" as null (auto-detect on write) rather than
      // collapsing to false — otherwise an unflagged non-ASCII value
      // would be silently encoded as ANSI and lose its high bytes.
      isUnicode: j.isUnicode == null ? null : !!j.isUnicode,
    });
  }
}
registerProperty('StrProperty', StrProperty);

// ── NameProperty / EnumProperty ─────────────────────────────────────────────
//
// Same wire layout (an FName); kept as separate classes so tag.type stays
// round-trippable through the registry. Values are coerced to FName on
// write so callers can assign a bare string and have it work. Static
// methods use `new this(...)` so inherited `fromReader` / `fromJSON`
// instantiate the right subclass.
class _FNameLeaf extends Property {
  constructor({ tag, value = null } = {}) {
    super({ tag });
    this.value = value;
  }
  static fromReader(cursor, tag) { return new this({ tag, value: FName.fromReader(cursor) }); }
  _writeValue(w) { FName.from(this.value).toBytes(w); }
  _writeJSON(j) { j.value = this.value instanceof FName ? this.value.toJSON() : this.value; }
  static fromJSON(j) { return new this({ tag: PropertyTag.fromJSON(j), value: FName.from(j.value) }); }
}

/**
 * `NameProperty`: leaf whose value is an `FName`. Same wire shape as
 * `EnumProperty`; kept as separate classes so `tag.type` round-trips.
 */
export class NameProperty extends _FNameLeaf {}

/**
 * `EnumProperty`: leaf whose value is the enum member's `FName`.
 */
export class EnumProperty extends _FNameLeaf {}

registerProperty('NameProperty', NameProperty);
registerProperty('EnumProperty', EnumProperty);

// ── ByteProperty ────────────────────────────────────────────────────────────
//
// Dual-form: when tag.enumName === 'None' the value is a raw u8; otherwise
// it's an FName (the enum member).

/**
 * Single-byte leaf. Dual wire form: when `tag.enumName.value === 'None'` the
 * value is a raw u8 (0..255); otherwise it's the FName of an enum member.
 */
export class ByteProperty extends Property {
  /**
   * @param {Object} [fields]
   * @param {PropertyTag} [fields.tag]
   * @param {number|FName} [fields.value=0]
   */
  constructor({ tag, value = 0 } = {}) {
    super({ tag });
    this.value = value;
  }
  static fromReader(cursor, tag) {
    const value = tag.enumName?.value === 'None' ? cursor.readUint8() : FName.fromReader(cursor);
    return new ByteProperty({ tag, value });
  }
  _writeValue(w) {
    if (this.tag.enumName?.value === 'None') w.writeUint8(this.value);
    else FName.from(this.value).toBytes(w);
  }
  _writeJSON(j) {
    j.value = this.value instanceof FName ? this.value.toJSON() : this.value;
  }
  static fromJSON(j) {
    const tag = PropertyTag.fromJSON(j);
    const value = tag.enumName?.value === 'None' ? j.value : FName.from(j.value);
    return new ByteProperty({ tag, value });
  }
}
registerProperty('ByteProperty', ByteProperty);
