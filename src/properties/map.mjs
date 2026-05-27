/**
 * `MapProperty`: ordered list of `{key, value}` entries with a preceding
 * "keys to remove" list.
 *
 * Wire layout:
 *
 *   [int32 NumRemoved] [removed keys...] [int32 NumEntries]
 *   [for each entry: key, value...]
 *
 * Soulmask quirks (matter for byte-identical round trip):
 *
 * 1. `Map<Struct, _>` keys are EITHER raw 16-byte FGuids (the guild
 *    manager maps in GAMEMODE) OR a nested property stream
 *    (`XinQingTagLog` - where each key is a `TagName` NameProperty
 *    wrapping a gameplay-effect tag identifier, terminated by None).
 *    The two are distinguished by peeking ahead with
 *    `peekLooksLikePropertyTag`.
 * 2. `Map<_, Struct>` values are EITHER a nested property stream
 *    (`GongHuiMap`, `PlayerGongHuiDataMap`, `GeRenJianZhuYingHuoList`,
 *    `GeRenMapRiZhi`) OR a raw 16-byte FGuid (`PlayerGongHuiMap` -
 *    a player->guild membership lookup). The two are distinguished by
 *    peeking ahead with `peekLooksLikePropertyTag`.
 *
 * Non-Struct key/value types share the array-element wire shape and
 * delegate to the shared element-codec.
 *
 * @module wscodec/properties/map
 */

import { Property, registerProperty } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { FGuid } from '../primitives.mjs';
import { peekLooksLikePropertyTag } from '../property-stream.mjs';
import { StructValue } from './struct.mjs';
import { readElement, writeElement, elementToJSON, elementFromJSON } from '../element-codec.mjs';

/**
 * Property wrapping an ordered map (with a separate "removed keys" list).
 * Entries preserve their wire order on `this.entries`.
 *
 * @typedef {{key: *, value: *}} MapEntry
 */

/**
 * Ordered map property.
 */
export class MapProperty extends Property {
  /**
   * @param {Object} [fields]
   * @param {PropertyTag} [fields.tag]
   * @param {Array<*>} [fields.removed=[]] - Removed keys.
   * @param {Array<MapEntry>} [fields.entries=[]] - Active `{key, value}` entries.
   */
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
//   - StructProperty key   → StructValue with form='propStream' OR FGuid;
//     decided by peeking for a PropertyTag-shaped name FString.
//   - StructProperty value → StructValue with form='propStream' OR FGuid;
//     decided by the same peek.
//   - everything else      → element-codec
function _readMapElement(cursor, type, isKey, ctx) {
  if (type === 'StructProperty') {
    if (peekLooksLikePropertyTag(cursor)) {
      return StructValue.fromReaderTagged(cursor, isKey ? '(map key)' : '(map value)', ctx);
    }
    return FGuid.fromReader(cursor).value;
  }
  return readElement(cursor, type, Infinity, ctx);
}

function _writeMapElement(writer, type, value, isKey, ctx) {
  if (type === 'StructProperty') {
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

function _mapElementToJSON(v, type, _isKey) {
  if (type === 'StructProperty') {
    if (v instanceof StructValue) return v.toJSON();
    return v;                                   // Guid string
  }
  return elementToJSON(v, type);
}

function _mapElementFromJSON(j, type, _isKey) {
  if (type === 'StructProperty') {
    if (j && typeof j === 'object' && j.form) return StructValue.fromJSON(j);
    return j;
  }
  return elementFromJSON(j, type);
}
