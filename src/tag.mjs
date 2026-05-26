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
 *   // type-specific tag data:
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
    switch (type.value) {
      case 'StructProperty': tag.structName = FName.fromReader(cursor); tag.structGuid = FGuid.fromReader(cursor); break;
      case 'BoolProperty':   tag.boolVal = cursor.readUint8(); break;
      case 'ByteProperty':
      case 'EnumProperty':   tag.enumName = FName.fromReader(cursor); break;
      case 'ArrayProperty':
      case 'SetProperty':    tag.innerType = FName.fromReader(cursor); break;
      case 'MapProperty':    tag.innerType = FName.fromReader(cursor); tag.valueType = FName.fromReader(cursor); break;
    }
    tag.hasPropertyGuid = cursor.readUint8() !== 0;
    if (tag.hasPropertyGuid) tag.propertyGuid = FGuid.fromReader(cursor);
    return tag;
  }

  /**
   * Emit the tag bytes. `size` is the byte count of the value payload that
   * will follow; the caller computes it by encoding the value into a sub-buffer
   * and measuring.
   */
  toBytes(writer, size) {
    this.name.toBytes(writer);
    if (this.isTerminator) return;
    this.type.toBytes(writer);
    writer.writeInt32(size);
    writer.writeInt32(this.arrayIndex);
    switch (this.type.value) {
      case 'StructProperty': this.structName.toBytes(writer); this.structGuid.toBytes(writer); break;
      case 'BoolProperty':   writer.writeUint8(this.boolVal); break;
      case 'ByteProperty':
      case 'EnumProperty':   this.enumName.toBytes(writer); break;
      case 'ArrayProperty':
      case 'SetProperty':    this.innerType.toBytes(writer); break;
      case 'MapProperty':    this.innerType.toBytes(writer); this.valueType.toBytes(writer); break;
    }
    writer.writeUint8(this.hasPropertyGuid ? 1 : 0);
    if (this.hasPropertyGuid) this.propertyGuid.toBytes(writer);
  }

  toJSON() {
    const j = { name: this.name.toJSON(), type: this.type.toJSON() };
    if (this.arrayIndex) j.arrayIndex = this.arrayIndex;
    switch (this.type?.value) {
      case 'StructProperty':
        j.structName = this.structName.toJSON();
        j.structGuid = this.structGuid.value;
        break;
      case 'BoolProperty':   j.boolVal = this.boolVal; break;
      case 'ByteProperty':
      case 'EnumProperty':   j.enumName = this.enumName.toJSON(); break;
      case 'ArrayProperty':
      case 'SetProperty':    j.innerType = this.innerType.toJSON(); break;
      case 'MapProperty':
        j.innerType = this.innerType.toJSON();
        j.valueType = this.valueType.toJSON();
        break;
    }
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
    switch (tag.type?.value) {
      case 'StructProperty':
        tag.structName = FName.from(j.structName);
        tag.structGuid = j.structGuid ? new FGuid(j.structGuid) : null;
        break;
      case 'BoolProperty':   tag.boolVal = j.boolVal; break;
      case 'ByteProperty':
      case 'EnumProperty':   tag.enumName = FName.from(j.enumName); break;
      case 'ArrayProperty':
      case 'SetProperty':    tag.innerType = FName.from(j.innerType); break;
      case 'MapProperty':
        tag.innerType = FName.from(j.innerType);
        tag.valueType = FName.from(j.valueType);
        break;
    }
    if (tag.hasPropertyGuid) tag.propertyGuid = j.propertyGuid ? new FGuid(j.propertyGuid) : null;
    return tag;
  }
}
