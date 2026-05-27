/**
 * Shared element codec for homogeneous container properties.
 *
 * ArrayProperty / SetProperty / MapProperty all need to read/write/JSON
 * elements of a single declared inner type (or two, for Map). The wire
 * shape for any given inner type is identical across containers — there
 * is no per-element tag wrapper. This module is the single place that
 * encoding lives.
 *
 * One handler table (`ELEMENT_CODECS`) per inner type provides
 * `{ read, write, toJSON, fromJSON }`; the four exported dispatch
 * functions just look up and call. Aliases (Enum→Name, Class/Weak/
 * Lazy/WS→Object, SoftClass→SoftObject) share the same handler so
 * there is no chance of one accessor drifting from another.
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

const identity = v => v;
const toJSONCall = v => v.toJSON();

const ELEMENT_CODECS = {
  IntProperty:    { read: c => c.readInt32(),               write: (w, v) => w.writeInt32(v),   toJSON: identity, fromJSON: identity },
  Int8Property:   { read: c => c.readInt8(),                write: (w, v) => w.writeInt8(v),    toJSON: identity, fromJSON: identity },
  Int16Property:  { read: c => c.readInt16(),               write: (w, v) => w.writeInt16(v),   toJSON: identity, fromJSON: identity },
  Int64Property:  { read: c => c.readInt64().toString(),    write: (w, v) => w.writeInt64(v),   toJSON: identity, fromJSON: j => String(j) },
  UInt16Property: { read: c => c.readUint16(),              write: (w, v) => w.writeUint16(v),  toJSON: identity, fromJSON: identity },
  UInt32Property: { read: c => c.readUint32(),              write: (w, v) => w.writeUint32(v),  toJSON: identity, fromJSON: identity },
  UInt64Property: { read: c => c.readUint64().toString(),   write: (w, v) => w.writeUint64(v),  toJSON: identity, fromJSON: j => String(j) },
  FloatProperty:  { read: c => c.readFloat32(),             write: (w, v) => w.writeFloat32(v), toJSON: identity, fromJSON: identity },
  DoubleProperty: { read: c => c.readFloat64(),             write: (w, v) => w.writeFloat64(v), toJSON: identity, fromJSON: identity },
  BoolProperty:   { read: c => c.readUint8() !== 0,         write: (w, v) => w.writeUint8(v ? 1 : 0), toJSON: identity, fromJSON: identity },
  ByteProperty:   { read: c => c.readUint8(),               write: (w, v) => w.writeUint8(v),   toJSON: identity, fromJSON: identity },
  StrProperty:    { read: c => c.readFString().value,       write: (w, v) => w.writeFString(v), toJSON: identity, fromJSON: identity },

  NameProperty:   {
    read:     c       => FName.fromReader(c),
    write:    (w, v)  => FName.from(v).toBytes(w),
    toJSON:   toJSONCall,
    fromJSON: j       => FName.from(j),
  },

  TextProperty: {
    read:     (c, _s, ctx) => FTextValue.fromReader(c, Infinity, ctx),
    // OpaqueValue carry-through is a non-strict fallback; FTextValue is
    // the structured path. Both expose toBytes.
    write:    (w, v) => v.toBytes(w),
    toJSON:   toJSONCall,
    fromJSON: j      => FTextValue.fromJSON(j),
  },

  ObjectProperty: {
    read:    (c, sizeHint, ctx) => ObjectRef.fromReaderArrayElement(c, sizeHint, ctx),
    // Variable wire shape (kind-only, +path, +path+classPath, +embedded).
    // ObjectRef.toBytes decides per-field which to emit based on which
    // fields were on the wire at read time. A bare-string fallback
    // covers programmatic construction with a path only.
    write:   (w, v) => {
      if (v instanceof ObjectRef) { v.toBytes(w); return; }
      w.writeUint8(0x03);
      w.writeFString(v ?? '');
    },
    toJSON:   toJSONCall,
    fromJSON: j => ObjectRef.fromJSON(j),
  },

  SoftObjectProperty: {
    read:     c       => SoftObjectRef.fromReader(c),
    write:    (w, v)  => (v instanceof SoftObjectRef ? v : new SoftObjectRef(v)).toBytes(w),
    toJSON:   toJSONCall,
    fromJSON: j       => SoftObjectRef.fromJSON(j),
  },
};

// Aliases — identical wire shape, different declared type name in the
// outer property tag. Sharing the codec object means a fix to one applies
// to all.
ELEMENT_CODECS.EnumProperty        = ELEMENT_CODECS.NameProperty;
ELEMENT_CODECS.ClassProperty       = ELEMENT_CODECS.ObjectProperty;
ELEMENT_CODECS.WeakObjectProperty  = ELEMENT_CODECS.ObjectProperty;
ELEMENT_CODECS.LazyObjectProperty  = ELEMENT_CODECS.ObjectProperty;
ELEMENT_CODECS.WSObjectProperty    = ELEMENT_CODECS.ObjectProperty;
ELEMENT_CODECS.SoftClassProperty   = ELEMENT_CODECS.SoftObjectProperty;

/**
 * Inner-type names that resolve to ObjectRef on the wire. Exported so
 * containers (array.mjs) can branch on object-family without re-listing
 * the aliases.
 */
export const OBJECT_INNER_TYPES = new Set([
  'ObjectProperty', 'ClassProperty', 'WeakObjectProperty',
  'LazyObjectProperty', 'WSObjectProperty',
]);

function codec(innerType) {
  const c = ELEMENT_CODECS[innerType];
  if (!c) throw new Error(`element-codec: unsupported innerType '${innerType}'`);
  return c;
}

export function readElement(cursor, innerType, sizeHint, ctx) {
  return codec(innerType).read(cursor, sizeHint, ctx);
}

export function writeElement(writer, innerType, value, ctx) {
  codec(innerType).write(writer, value, ctx);
}

export function elementToJSON(value, innerType) {
  return codec(innerType).toJSON(value);
}

export function elementFromJSON(j, innerType) {
  if (OpaqueValue.isOpaqueJSON(j)) return OpaqueValue.fromJSON(j);
  return codec(innerType).fromJSON(j);
}
