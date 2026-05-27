/**
 * PropertyTag: the header preceding each property's value bytes.
 *
 * Wire layout (UE 4.27, FPropertyTag.h, Soulmask tweaks):
 *
 *   FString  Name
 *   [if Name == "None": stream terminator; no further fields]
 *   FString  Type
 *   int32    Size                  // bytes of value data following the tag
 *   int32    ArrayIndex
 *   // type-specific tag data (see TAG_EXTRAS):
 *   if Type == "StructProperty":  FString StructName + FGuid StructGuid
 *   if Type == "BoolProperty":    u8 BoolVal
 *   if Type == "ByteProperty":    FString EnumName
 *   if Type == "EnumProperty":    FString EnumName
 *   if Type == "ArrayProperty":   FString InnerType
 *   if Type == "SetProperty":     FString InnerType
 *   if Type == "MapProperty":     FString InnerType + FString ValueType
 *   u8       HasPropertyGuid
 *   if HasPropertyGuid:           FGuid PropertyGuid
 */

import { FName, FGuid } from './primitives.mjs';

// Per-type extension fields. One entry per Type with a `(tag, cursor)`
// reader, a `(tag, writer)` writer, and matching JSON encoders. The
// four switches over `tag.type.value` used to live inline in fromReader
// / toBytes / toJSON / fromJSON; collapsing them into a single table
// keeps the wire shape and JSON shape impossible to drift apart.
const TAG_EXTRAS = {
  StructProperty: {
    read:     (tag, c) => { tag.structName = FName.fromReader(c); tag.structGuid = FGuid.fromReader(c); },
    write:    (tag, w) => { tag.structName.toBytes(w); tag.structGuid.toBytes(w); },
    toJSON:   (tag, j) => { j.structName = tag.structName.toJSON(); j.structGuid = tag.structGuid.value; },
    fromJSON: (tag, j) => { tag.structName = FName.from(j.structName); tag.structGuid = j.structGuid ? new FGuid(j.structGuid) : null; },
  },
  BoolProperty: {
    read:     (tag, c) => { tag.boolVal = c.readUint8(); },
    write:    (tag, w) => { w.writeUint8(tag.boolVal); },
    toJSON:   (tag, j) => { j.boolVal = tag.boolVal; },
    fromJSON: (tag, j) => { tag.boolVal = j.boolVal; },
  },
  ByteProperty: {
    read:     (tag, c) => { tag.enumName = FName.fromReader(c); },
    write:    (tag, w) => { tag.enumName.toBytes(w); },
    toJSON:   (tag, j) => { j.enumName = tag.enumName.toJSON(); },
    fromJSON: (tag, j) => { tag.enumName = FName.from(j.enumName); },
  },
  ArrayProperty: {
    read:     (tag, c) => { tag.innerType = FName.fromReader(c); },
    write:    (tag, w) => { tag.innerType.toBytes(w); },
    toJSON:   (tag, j) => { j.innerType = tag.innerType.toJSON(); },
    fromJSON: (tag, j) => { tag.innerType = FName.from(j.innerType); },
  },
  MapProperty: {
    read:     (tag, c) => { tag.innerType = FName.fromReader(c); tag.valueType = FName.fromReader(c); },
    write:    (tag, w) => { tag.innerType.toBytes(w); tag.valueType.toBytes(w); },
    toJSON:   (tag, j) => { j.innerType = tag.innerType.toJSON(); j.valueType = tag.valueType.toJSON(); },
    fromJSON: (tag, j) => { tag.innerType = FName.from(j.innerType); tag.valueType = FName.from(j.valueType); },
  },
};
TAG_EXTRAS.EnumProperty = TAG_EXTRAS.ByteProperty;
TAG_EXTRAS.SetProperty  = TAG_EXTRAS.ArrayProperty;

export class PropertyTag {
  constructor(fields = {}) {
    this.name = fields.name ?? null;
    this.type = fields.type ?? null;
    this.arrayIndex = fields.arrayIndex ?? 0;
    this.structName = fields.structName ?? null;
    this.structGuid = fields.structGuid ?? null;
    this.boolVal = fields.boolVal ?? null;
    this.enumName = fields.enumName ?? null;
    this.innerType = fields.innerType ?? null;
    this.valueType = fields.valueType ?? null;
    this.hasPropertyGuid = !!fields.hasPropertyGuid;
    this.propertyGuid = fields.propertyGuid ?? null;
    this.isTerminator = !!fields.isTerminator;
  }

  /**
   * Read a PropertyTag from the cursor. The wire `size` field is captured
   * in `tag._readSize` (transient — used by Property.fromReader as the
   * value-decoding byte budget, then discarded).
   */
  static fromReader(cursor) {
    const name = FName.fromReader(cursor);
    if (name.value === 'None') {
      return new PropertyTag({ name, isTerminator: true });
    }
    const type = FName.fromReader(cursor);
    const size = cursor.readInt32();
    const arrayIndex = cursor.readInt32();
    const tag = new PropertyTag({ name, type, arrayIndex });
    tag._readSize = size;
    TAG_EXTRAS[type.value]?.read(tag, cursor);
    tag.hasPropertyGuid = cursor.readUint8() !== 0;
    if (tag.hasPropertyGuid) tag.propertyGuid = FGuid.fromReader(cursor);
    return tag;
  }

  /**
   * Emit the tag bytes with a zero placeholder for the `size` field, and
   * return the absolute writer offset of that placeholder so the caller
   * can patch it once the value bytes have been written. This lets us
   * encode a property in a single forward pass — no sub-buffering of the
   * value just to measure its size.
   *
   * Terminator tags have no size field and no further payload; this
   * returns -1 so the caller can branch (though in practice terminator
   * tags are emitted directly via `new FName('None').toBytes(writer)` and
   * don't pass through this method).
   */
  toBytes(writer) {
    this.name.toBytes(writer);
    if (this.isTerminator) return -1;
    this.type.toBytes(writer);
    const sizePos = writer.pos();
    writer.writeInt32(0);                  // placeholder; back-patched by caller
    writer.writeInt32(this.arrayIndex);
    TAG_EXTRAS[this.type.value]?.write(this, writer);
    writer.writeUint8(this.hasPropertyGuid ? 1 : 0);
    if (this.hasPropertyGuid) this.propertyGuid.toBytes(writer);
    return sizePos;
  }

  toJSON() {
    const j = { name: this.name.toJSON(), type: this.type.toJSON() };
    if (this.arrayIndex) j.arrayIndex = this.arrayIndex;
    TAG_EXTRAS[this.type?.value]?.toJSON(this, j);
    if (this.hasPropertyGuid) {
      j.hasPropertyGuid = true;
      j.propertyGuid = this.propertyGuid.value;
    }
    return j;
  }

  static fromJSON(j) {
    const tag = new PropertyTag({
      name: FName.from(j.name),
      type: FName.from(j.type),
      arrayIndex: j.arrayIndex || 0,
      hasPropertyGuid: !!j.hasPropertyGuid,
    });
    TAG_EXTRAS[tag.type?.value]?.fromJSON(tag, j);
    if (tag.hasPropertyGuid) tag.propertyGuid = j.propertyGuid ? new FGuid(j.propertyGuid) : null;
    return tag;
  }
}
