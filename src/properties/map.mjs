/**
 * MapProperty: ordered list of {key, value} entries with a preceding
 * "keys to remove" list.
 *
 * Wire layout: [int32 NumRemoved] [removed keys...] [int32 NumEntries]
 *              [for each entry: key, value...]
 *
 * Soulmask quirks (matter for byte-identical round trip):
 *
 *   1. Map<Struct, _> keys are always raw 16-byte FGuids on the wire
 *      (no inner PropertyTag, no nested stream). Every populated
 *      Map<Struct, _> observed in world.db (the guild manager maps in
 *      GAMEMODE) uses Guids as keys.
 *
 *   2. Map<_, Struct> values are EITHER a nested property stream
 *      (`GongHuiMap`, `PlayerGongHuiDataMap`, `GeRenJianZhuYingHuoList`,
 *      `GeRenMapRiZhi`) OR a raw 16-byte FGuid (`PlayerGongHuiMap` —
 *      a player→guild membership lookup). The two are distinguished by
 *      peeking ahead with `peekLooksLikePropertyTag`.
 *
 * Non-Struct key/value types share the array-element wire shape and
 * delegate to the shared element-codec.
 */

import { Property, registerProperty } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { FGuid } from '../primitives.mjs';
import { peekLooksLikePropertyTag } from '../property-stream.mjs';
import { StructValue } from './struct.mjs';
import { readElement, writeElement, elementToJSON, elementFromJSON } from '../element-codec.mjs';

export class MapProperty extends Property {
  constructor({ tag, removed = [], entries = [] } = {}) {
    super({ tag });
    this.removed = removed;
    this.entries = entries;
  }

  static fromReader(cursor, tag, _sizeHint, ctx) {
    const keyType = tag.innerType.value;
    const valType = tag.valueType.value;
    const numKeysToRemove = cursor.readInt32();
    const removed = [];
    for (let i = 0; i < numKeysToRemove; i++) {
      removed.push(_readMapElement(cursor, keyType, /*isKey=*/true, ctx));
    }
    const numEntries = cursor.readInt32();
    const entries = [];
    for (let i = 0; i < numEntries; i++) {
      const key   = _readMapElement(cursor, keyType, true, ctx);
      const value = _readMapElement(cursor, valType, false, ctx);
      entries.push({ key, value });
    }
    return new MapProperty({ tag, removed, entries });
  }

  _writeValue(writer, ctx) {
    const keyType = this.tag.innerType.value;
    const valType = this.tag.valueType.value;
    writer.writeInt32(this.removed.length);
    for (const k of this.removed) _writeMapElement(writer, keyType, k, true, ctx);
    writer.writeInt32(this.entries.length);
    for (const e of this.entries) {
      _writeMapElement(writer, keyType, e.key,   true,  ctx);
      _writeMapElement(writer, valType, e.value, false, ctx);
    }
  }

  _writeJSON(j) {
    const keyType = this.tag.innerType.value;
    const valType = this.tag.valueType.value;
    j.removed = this.removed.map(k => _mapElementToJSON(k, keyType, true));
    j.entries = this.entries.map(e => ({
      key:   _mapElementToJSON(e.key,   keyType, true),
      value: _mapElementToJSON(e.value, valType, false),
    }));
  }

  static fromJSON(j) {
    const tag = PropertyTag.fromJSON(j);
    const keyType = tag.innerType.value;
    const valType = tag.valueType.value;
    return new MapProperty({
      tag,
      removed: (j.removed ?? []).map(k => _mapElementFromJSON(k, keyType, true)),
      entries: (j.entries ?? []).map(e => ({
        key:   _mapElementFromJSON(e.key,   keyType, true),
        value: _mapElementFromJSON(e.value, valType, false),
      })),
    });
  }
}

registerProperty('MapProperty', MapProperty);

// Per the header quirks:
//   - StructProperty key   → raw FGuid string
//   - StructProperty value → StructValue with form='propStream' OR FGuid;
//     decided by peeking for a PropertyTag-shaped name FString.
//   - everything else      → element-codec
function _readMapElement(cursor, type, isKey, ctx) {
  if (type === 'StructProperty') {
    if (isKey) return FGuid.fromReader(cursor).value;
    if (peekLooksLikePropertyTag(cursor)) {
      return StructValue.fromReaderTagged(cursor, '(map value)', ctx);
    }
    return FGuid.fromReader(cursor).value;
  }
  return readElement(cursor, type, Infinity, ctx);
}

function _writeMapElement(writer, type, value, isKey, ctx) {
  if (type === 'StructProperty') {
    if (isKey) { new FGuid(value).toBytes(writer); return; }
    if (value instanceof StructValue && value.form === 'propStream') {
      // Property-stream body + None terminator (stream.toBytes appends it).
      value.stream.toBytes(writer);
      return;
    }
    if (typeof value === 'string') { new FGuid(value).toBytes(writer); return; }
    throw new Error('MapProperty: unexpected StructProperty value shape');
  }
  writeElement(writer, type, value, ctx);
}

function _mapElementToJSON(v, type, isKey) {
  if (type === 'StructProperty') {
    if (isKey) return v;                       // Guid string
    if (v instanceof StructValue) return v.toJSON();
    return v;                                   // Guid string
  }
  return elementToJSON(v, type);
}

function _mapElementFromJSON(j, type, isKey) {
  if (type === 'StructProperty') {
    if (isKey) return j;
    if (j && typeof j === 'object' && j.form) return StructValue.fromJSON(j);
    return j;
  }
  return elementFromJSON(j, type);
}
