/**
 * Leaf property types: primitives whose value is a single number, bool,
 * string, or FName. No nested decoding, no per-type wire quirks beyond
 * what `Cursor`/`Writer` already provide.
 *
 * Grouped here because each class is just a thin wrapper around one
 * read/write primitive; splitting them across files would be more
 * navigation than structure.
 */

import { Property, registerProperty } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { FName } from '../primitives.mjs';

// ── Numeric leaves ──────────────────────────────────────────────────────────
//
// 64-bit integers are exchanged as decimal strings throughout the codec to
// avoid JavaScript Number precision loss above 2^53; `Writer.writeInt64`
// accepts string/BigInt/safe-integer-Number with the same contract.

class _IntegerProperty extends Property {
  constructor({ tag, value = 0 } = {}) {
    super({ tag });
    this.value = value;
  }

  _writeJSON(j) { j.value = this.value; }

  static fromJSONFor(Cls) {
    return j => new Cls({ tag: PropertyTag.fromJSON(j), value: j.value });
  }
}

export class IntProperty extends _IntegerProperty {
  static fromReader(cursor, tag) { return new IntProperty({ tag, value: cursor.readInt32() }); }
  _writeValue(w) { w.writeInt32(this.value); }
}
IntProperty.fromJSON = _IntegerProperty.fromJSONFor(IntProperty);

export class Int8Property extends _IntegerProperty {
  static fromReader(cursor, tag) { return new Int8Property({ tag, value: cursor.readInt8() }); }
  _writeValue(w) { w.writeInt8(this.value); }
}
Int8Property.fromJSON = _IntegerProperty.fromJSONFor(Int8Property);

export class Int16Property extends _IntegerProperty {
  static fromReader(cursor, tag) { return new Int16Property({ tag, value: cursor.readInt16() }); }
  _writeValue(w) { w.writeInt16(this.value); }
}
Int16Property.fromJSON = _IntegerProperty.fromJSONFor(Int16Property);

export class UInt16Property extends _IntegerProperty {
  static fromReader(cursor, tag) { return new UInt16Property({ tag, value: cursor.readUint16() }); }
  _writeValue(w) { w.writeUint16(this.value); }
}
UInt16Property.fromJSON = _IntegerProperty.fromJSONFor(UInt16Property);

export class UInt32Property extends _IntegerProperty {
  static fromReader(cursor, tag) { return new UInt32Property({ tag, value: cursor.readUint32() }); }
  _writeValue(w) { w.writeUint32(this.value); }
}
UInt32Property.fromJSON = _IntegerProperty.fromJSONFor(UInt32Property);

export class Int64Property extends _IntegerProperty {
  // Stored as a decimal string (see header note).
  constructor(opts = {}) { super({ ...opts, value: opts.value ?? '0' }); }
  static fromReader(cursor, tag) { return new Int64Property({ tag, value: cursor.readInt64().toString() }); }
  _writeValue(w) { w.writeInt64(this.value); }
}
Int64Property.fromJSON = j => new Int64Property({ tag: PropertyTag.fromJSON(j), value: String(j.value) });

export class UInt64Property extends _IntegerProperty {
  constructor(opts = {}) { super({ ...opts, value: opts.value ?? '0' }); }
  static fromReader(cursor, tag) { return new UInt64Property({ tag, value: cursor.readUint64().toString() }); }
  _writeValue(w) { w.writeUint64(this.value); }
}
UInt64Property.fromJSON = j => new UInt64Property({ tag: PropertyTag.fromJSON(j), value: String(j.value) });

export class FloatProperty extends _IntegerProperty {
  static fromReader(cursor, tag) { return new FloatProperty({ tag, value: cursor.readFloat32() }); }
  _writeValue(w) { w.writeFloat32(this.value); }
}
FloatProperty.fromJSON = _IntegerProperty.fromJSONFor(FloatProperty);

export class DoubleProperty extends _IntegerProperty {
  static fromReader(cursor, tag) { return new DoubleProperty({ tag, value: cursor.readFloat64() }); }
  _writeValue(w) { w.writeFloat64(this.value); }
}
DoubleProperty.fromJSON = _IntegerProperty.fromJSONFor(DoubleProperty);

// ── BoolProperty ────────────────────────────────────────────────────────────
//
// The value lives on tag.boolVal (the wire stores it in the tag itself, no
// payload bytes follow). `Property.toBytes` writes the tag with size=0 and
// the empty value buffer, so the boolVal byte is in the tag bytes.
export class BoolProperty extends Property {
  constructor({ tag, value = false } = {}) {
    super({ tag });
    this.value = value;
    if (tag) tag.boolVal = value ? 1 : 0;
  }
  static fromReader(_cursor, tag) {
    return new BoolProperty({ tag, value: tag.boolVal !== 0 });
  }
  _writeValue(_w) { /* value lives in the tag */ }
  _writeJSON(j) { j.value = this.value; j.boolVal = this.tag.boolVal; }
  static fromJSON(j) {
    const tag = PropertyTag.fromJSON(j);
    tag.boolVal = j.boolVal ?? (j.value ? 1 : 0);
    return new BoolProperty({ tag, value: !!j.value });
  }
}

// ── StrProperty ─────────────────────────────────────────────────────────────
export class StrProperty extends Property {
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
      isUnicode: !!j.isUnicode,
    });
  }
}

// ── NameProperty ────────────────────────────────────────────────────────────
//
// The value is an FName (bare FString in Soulmask's property-stream form).
export class NameProperty extends Property {
  constructor({ tag, value = null } = {}) {
    super({ tag });
    this.value = value;
  }
  static fromReader(cursor, tag) { return new NameProperty({ tag, value: FName.fromReader(cursor) }); }
  _writeValue(w) { this.value.toBytes(w); }
  _writeJSON(j) { j.value = this.value.toJSON(); }
  static fromJSON(j) {
    return new NameProperty({ tag: PropertyTag.fromJSON(j), value: FName.from(j.value) });
  }
}

// ── ByteProperty ────────────────────────────────────────────────────────────
//
// Dual-form: when tag.enumName === 'None' the value is a raw u8; otherwise
// it's an FName (the enum member).
export class ByteProperty extends Property {
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

// ── EnumProperty ────────────────────────────────────────────────────────────
export class EnumProperty extends Property {
  constructor({ tag, value = null } = {}) {
    super({ tag });
    this.value = value;
  }
  static fromReader(cursor, tag) { return new EnumProperty({ tag, value: FName.fromReader(cursor) }); }
  _writeValue(w) { FName.from(this.value).toBytes(w); }
  _writeJSON(j) { j.value = this.value instanceof FName ? this.value.toJSON() : this.value; }
  static fromJSON(j) {
    return new EnumProperty({ tag: PropertyTag.fromJSON(j), value: FName.from(j.value) });
  }
}

// ── Registration ────────────────────────────────────────────────────────────
registerProperty('IntProperty', IntProperty);
registerProperty('Int8Property', Int8Property);
registerProperty('Int16Property', Int16Property);
registerProperty('Int64Property', Int64Property);
registerProperty('UInt16Property', UInt16Property);
registerProperty('UInt32Property', UInt32Property);
registerProperty('UInt64Property', UInt64Property);
registerProperty('FloatProperty', FloatProperty);
registerProperty('DoubleProperty', DoubleProperty);
registerProperty('BoolProperty', BoolProperty);
registerProperty('StrProperty', StrProperty);
registerProperty('NameProperty', NameProperty);
registerProperty('ByteProperty', ByteProperty);
registerProperty('EnumProperty', EnumProperty);
