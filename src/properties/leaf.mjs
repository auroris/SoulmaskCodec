/**
 * Leaf property types: primitives whose value is a single number, bool,
 * string, or FName. No nested decoding, no per-type wire quirks beyond
 * what `Cursor`/`Writer` already provide.
 *
 * The nine numeric leaves are generated from `NUMERIC_LEAVES`; the
 * less-uniform ones (Bool, Str, Name, Byte, Enum) are hand-written
 * because each has a distinct twist (tag-stored value, isNull/isUnicode
 * wire flags, dual form, FName coercion).
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

/**
 * Build a numeric Property subclass for the given UE type name. The returned
 * class implements `fromReader` / `_writeValue` / `_writeJSON` / `fromJSON`
 * by delegating to the `spec` handlers.
 *
 * @param {string} name  UE type name (e.g. `'IntProperty'`).
 * @param {{read: Function, write: Function, default: any, fromJSON: Function}} spec
 * @returns {typeof Property}
 */
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

/**
 * Boolean property. The wire byte lives in `tag.boolVal`, not in the value
 * payload — `Property.toBytes` writes the tag with size=0 and an empty
 * value buffer. The `value` accessor is a getter/setter over `tag.boolVal`
 * so the two cannot go stale relative to each other.
 */
export class BoolProperty extends Property {
  /**
   * @param {object} [opts]
   * @param {import('../tag.mjs').PropertyTag} [opts.tag]
   * @param {boolean} [opts.value]
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

/**
 * UE FString property. Round-trips the wire-form encoding (`isUnicode`) and
 * the null vs. empty-with-terminator distinction (`isNull`) so encoding is
 * byte-identical.
 */
export class StrProperty extends Property {
  /**
   * @param {object} [opts]
   * @param {import('../tag.mjs').PropertyTag} [opts.tag]
   * @param {string}        [opts.value]
   * @param {boolean}       [opts.isNull]    Only meaningful when `value === ''`. See `Writer.writeFString`.
   * @param {boolean|null}  [opts.isUnicode] null = auto-detect on write.
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

/**
 * Shared base for NameProperty and EnumProperty (identical FName wire layout;
 * kept as separate exports so `tag.type` round-trips through the registry).
 * Values are coerced to {@link FName} on write so callers can assign a bare
 * string and have it work.
 *
 * @internal
 */
class _FNameLeaf extends Property {
  /**
   * @param {object} [opts]
   * @param {import('../tag.mjs').PropertyTag} [opts.tag]
   * @param {FName|string|null} [opts.value]
   */
  constructor({ tag, value = null } = {}) {
    super({ tag });
    this.value = value;
  }
  static fromReader(cursor, tag) { return new this({ tag, value: FName.fromReader(cursor) }); }
  _writeValue(w) { FName.from(this.value).toBytes(w); }
  _writeJSON(j) { j.value = this.value instanceof FName ? this.value.toJSON() : this.value; }
  static fromJSON(j) { return new this({ tag: PropertyTag.fromJSON(j), value: FName.from(j.value) }); }
}

/** FName-valued property (e.g. an asset reference or a tag name). */
export class NameProperty extends _FNameLeaf {}
/** FName-valued enum property; the enum type lives on `tag.enumName`. */
export class EnumProperty extends _FNameLeaf {}

registerProperty('NameProperty', NameProperty);
registerProperty('EnumProperty', EnumProperty);

/**
 * Dual-form property: when `tag.enumName === 'None'` the value is a raw
 * `u8`; otherwise it's an {@link FName} naming an enum member.
 */
export class ByteProperty extends Property {
  /**
   * @param {object} [opts]
   * @param {import('../tag.mjs').PropertyTag} [opts.tag]
   * @param {number|FName|string} [opts.value]
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
