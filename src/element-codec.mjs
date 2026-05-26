/**
 * Shared element codec for homogeneous container properties.
 *
 * ArrayProperty / SetProperty / MapProperty all need to read/write/JSON
 * elements of a single declared inner type (or two, for Map). The wire
 * shape for any given inner type is identical across containers — there
 * is no per-element tag wrapper. This module is the single place that
 * encoding lives.
 *
 *   readElement  / writeElement       — wire bytes
 *   elementToJSON / elementFromJSON   — JSON form
 *
 * `StructProperty` inner type is NOT handled here, because the three
 * containers differ in what they do with structs:
 *   - ArrayProperty<Struct>: nested PropertyStream per element via
 *     StructValue (with a shared inner PropertyTag).
 *   - SetProperty<Struct>: raw 16-byte FGuid per element.
 *   - MapProperty<Struct, _>: raw 16-byte FGuid as key.
 *   - MapProperty<_, Struct>: nested PropertyStream OR raw FGuid as
 *     value, decided by a peek heuristic.
 * Each container's reader/writer handles its Struct case before
 * delegating to these helpers for non-Struct cases.
 *
 * `sizeHint` is only consulted for ObjectProperty-family elements
 * (variable wire shape; needs a byte budget for the four-guard decode in
 * object.mjs). For all other inner types it's ignored. Set/Map pass
 * `Infinity` because they have no per-element budget — Soulmask data
 * doesn't exercise Set<Object> / Map<_,Object> so the heuristics haven't
 * been stress-tested in those contexts.
 */

import { FName } from './primitives.mjs';
import { ObjectRef } from './properties/object.mjs';
import { SoftObjectRef } from './properties/soft-object.mjs';
import { FTextValue } from './properties/text.mjs';
import { OpaqueValue } from './properties/opaque.mjs';

export function readElement(cursor, innerType, sizeHint, ctx) {
  switch (innerType) {
    case 'IntProperty':    return cursor.readInt32();
    case 'Int8Property':   return cursor.readInt8();
    case 'Int16Property':  return cursor.readInt16();
    case 'Int64Property':  return cursor.readInt64().toString();
    case 'UInt16Property': return cursor.readUint16();
    case 'UInt32Property': return cursor.readUint32();
    case 'UInt64Property': return cursor.readUint64().toString();
    case 'FloatProperty':  return cursor.readFloat32();
    case 'DoubleProperty': return cursor.readFloat64();
    case 'BoolProperty':   return cursor.readUint8() !== 0;
    case 'ByteProperty':   return cursor.readUint8();
    case 'EnumProperty':
    case 'NameProperty':   return FName.fromReader(cursor);
    case 'StrProperty':    return cursor.readFString().value;
    case 'TextProperty':   return FTextValue.fromReader(cursor, Infinity, ctx);
    case 'ObjectProperty':
    case 'ClassProperty':
    case 'WeakObjectProperty':
    case 'LazyObjectProperty':
    case 'WSObjectProperty':
      return ObjectRef.fromReaderArrayElement(cursor, sizeHint, ctx);
    case 'SoftObjectProperty':
    case 'SoftClassProperty':
      return SoftObjectRef.fromReader(cursor);
    default:
      throw new Error(`element-codec: unsupported innerType '${innerType}'`);
  }
}

export function writeElement(writer, innerType, value, _ctx) {
  switch (innerType) {
    case 'IntProperty':    writer.writeInt32(value);   return;
    case 'Int8Property':   writer.writeInt8(value);    return;
    case 'Int16Property':  writer.writeInt16(value);   return;
    case 'Int64Property':  writer.writeInt64(value);   return;
    case 'UInt16Property': writer.writeUint16(value);  return;
    case 'UInt32Property': writer.writeUint32(value);  return;
    case 'UInt64Property': writer.writeUint64(value);  return;
    case 'FloatProperty':  writer.writeFloat32(value); return;
    case 'DoubleProperty': writer.writeFloat64(value); return;
    case 'BoolProperty':   writer.writeUint8(value ? 1 : 0); return;
    case 'ByteProperty':   writer.writeUint8(value);   return;
    case 'EnumProperty':
    case 'NameProperty':   FName.from(value).toBytes(writer); return;
    case 'StrProperty':    writer.writeFString(value); return;
    case 'TextProperty':
      // OpaqueValue carry-through is a non-strict fallback; FTextValue is
      // the structured path. Both expose toBytes.
      value.toBytes(writer); return;
    case 'ObjectProperty':
    case 'ClassProperty':
    case 'WeakObjectProperty':
    case 'LazyObjectProperty':
    case 'WSObjectProperty':
      // Variable wire shape (kind-only, +path, +path+classPath, +embedded).
      // ObjectRef.toBytes decides per-field which to emit based on which
      // fields were on the wire at read time. A bare-string fallback
      // covers programmatic construction with a path only.
      if (value instanceof ObjectRef) { value.toBytes(writer); return; }
      writer.writeUint8(0x03);
      writer.writeFString(value ?? '');
      return;
    case 'SoftObjectProperty':
    case 'SoftClassProperty':
      (value instanceof SoftObjectRef ? value : new SoftObjectRef(value)).toBytes(writer);
      return;
    default:
      throw new Error(`element-codec: unsupported innerType '${innerType}'`);
  }
}

export function elementToJSON(value, innerType) {
  switch (innerType) {
    case 'IntProperty':    case 'Int8Property':   case 'Int16Property':
    case 'UInt16Property': case 'UInt32Property':
    case 'FloatProperty':  case 'DoubleProperty':
    case 'BoolProperty':   case 'ByteProperty':
      return value;
    case 'Int64Property':  case 'UInt64Property': return value;     // already string
    case 'StrProperty':    return value;
    case 'EnumProperty':
    case 'NameProperty':   return value.toJSON();
    case 'TextProperty':   return value.toJSON();
    case 'ObjectProperty':
    case 'ClassProperty':
    case 'WeakObjectProperty':
    case 'LazyObjectProperty':
    case 'WSObjectProperty':
      return value.toJSON();
    case 'SoftObjectProperty':
    case 'SoftClassProperty':
      return value.toJSON();
    default:
      throw new Error(`element-codec: unsupported innerType '${innerType}'`);
  }
}

export function elementFromJSON(j, innerType) {
  if (OpaqueValue.isOpaqueJSON(j)) return OpaqueValue.fromJSON(j);
  switch (innerType) {
    case 'IntProperty':    case 'Int8Property':   case 'Int16Property':
    case 'UInt16Property': case 'UInt32Property':
    case 'FloatProperty':  case 'DoubleProperty':
    case 'BoolProperty':   case 'ByteProperty':
      return j;
    case 'Int64Property':  case 'UInt64Property': return String(j);
    case 'StrProperty':    return j;
    case 'EnumProperty':
    case 'NameProperty':   return FName.from(j);
    case 'TextProperty':   return FTextValue.fromJSON(j);
    case 'ObjectProperty':
    case 'ClassProperty':
    case 'WeakObjectProperty':
    case 'LazyObjectProperty':
    case 'WSObjectProperty':
      return ObjectRef.fromJSON(j);
    case 'SoftObjectProperty':
    case 'SoftClassProperty':
      return SoftObjectRef.fromJSON(j);
    default:
      throw new Error(`element-codec: unsupported innerType '${innerType}'`);
  }
}
