/**
 * SetProperty: homogeneous unordered collection with a "removed" list
 * preceding the active entries.
 *
 * Wire layout: [int32 NumRemoved] [removed...] [int32 NumElements] [elements...]
 *
 * Set element shapes match ArrayProperty's element shapes for non-Struct
 * inner types and are read/written via the shared element-codec. For
 * StructProperty inner type, elements are EITHER raw 16-byte FGuids (the
 * common case across Soulmask saves) OR a nested property stream (mirrors
 * Map<Struct, _> key disambiguation; no Set<Struct> property-stream case
 * has been observed in saves but the codec stays robust against one).
 * The two are distinguished by peeking with `peekLooksLikePropertyTag` —
 * random FGuid bytes effectively never satisfy the identifier-FString
 * test, so this peek is safe.
 *
 * Set<ObjectProperty> isn't exercised by observed Soulmask data; the
 * element-codec dispatches with `Infinity` sizeHint in that case, which
 * is approximate but should work for the standard wire shape (kind +
 * path + optional classPath).
 */

import { Property, registerProperty, warnOrThrow } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { FGuid } from '../primitives.mjs';
import { peekLooksLikePropertyTag } from '../property-stream.mjs';
import { StructValue } from './struct.mjs';
import { readElement, writeElement, elementToJSON, elementFromJSON } from '../element-codec.mjs';

/**
 * UE SetProperty: a homogeneous unordered collection. `removed` carries the
 * delta-list that precedes the active entries on the wire (often empty in
 * Soulmask saves but always present in the layout).
 */
export class SetProperty extends Property {
  /**
   * @param {object} [opts]
   * @param {import('../tag.mjs').PropertyTag} [opts.tag]
   * @param {any[]} [opts.removed]
   * @param {any[]} [opts.elements]
   */
  constructor({ tag, removed = [], elements = [] } = {}) {
    super({ tag });
    this.removed = removed;
    this.elements = elements;
  }

  static fromReader(cursor, tag, _sizeHint, ctx) {
    const innerType = tag.innerType.value;
    const numToRemove = cursor.readInt32();
    const removed = [];
    for (let i = 0; i < numToRemove; i++) removed.push(_readSetElement(cursor, innerType, ctx));
    const numElements = cursor.readInt32();
    const elements = [];
    for (let i = 0; i < numElements; i++) elements.push(_readSetElement(cursor, innerType, ctx));
    return new SetProperty({ tag, removed, elements });
  }

  _writeValue(writer, ctx) {
    const innerType = this.tag.innerType.value;
    writer.writeInt32(this.removed.length);
    for (const v of this.removed) _writeSetElement(writer, innerType, v, ctx);
    writer.writeInt32(this.elements.length);
    for (const v of this.elements) _writeSetElement(writer, innerType, v, ctx);
  }

  _writeJSON(j) {
    const innerType = this.tag.innerType.value;
    j.removed  = this.removed.map(e => _setElementToJSON(e, innerType));
    j.elements = this.elements.map(e => _setElementToJSON(e, innerType));
  }

  static fromJSON(j) {
    const tag = PropertyTag.fromJSON(j);
    const innerType = tag.innerType.value;
    return new SetProperty({
      tag,
      removed:  (j.removed  ?? []).map(e => _setElementFromJSON(e, innerType)),
      elements: (j.elements ?? []).map(e => _setElementFromJSON(e, innerType)),
    });
  }
}

registerProperty('SetProperty', SetProperty);

// Set<Struct> elements: peek to choose FGuid vs nested property stream
// (mirrors map.mjs's key/value disambiguation). Everything else delegates
// to the shared element codec.
function _readSetElement(cursor, innerType, ctx) {
  if (innerType === 'StructProperty') {
    if (peekLooksLikePropertyTag(cursor)) {
      const startOff = cursor.pos();
      const sv = StructValue.fromReaderTagged(cursor, '(set element)', ctx);
      // Mirrors map.mjs: a peek-chosen tagged stream MUST terminate with
      // None. A non-terminated stream signals a peek misfire (FGuid bytes
      // that happened to look identifier-shaped) — flag with location.
      if (!sv.stream.terminated) {
        warnOrThrow(ctx,
          `SetProperty: element tagged stream at offset ${startOff} ` +
          `did not terminate (peek heuristic likely misfired on FGuid bytes).`);
      }
      return sv;
    }
    return FGuid.fromReader(cursor).value;
  }
  return readElement(cursor, innerType, Infinity, ctx);
}

function _writeSetElement(writer, innerType, value, ctx) {
  if (innerType === 'StructProperty') {
    if (value instanceof StructValue && value.form === 'propStream') {
      value.stream.toBytes(writer);
      return;
    }
    new FGuid(value).toBytes(writer);
    return;
  }
  writeElement(writer, innerType, value, ctx);
}

function _setElementToJSON(e, innerType) {
  if (innerType === 'StructProperty') {
    if (e instanceof StructValue) return e.toJSON();
    return e;                                          // Guid string
  }
  return elementToJSON(e, innerType);
}

function _setElementFromJSON(j, innerType) {
  if (innerType === 'StructProperty') {
    if (j && typeof j === 'object' && j.form) return StructValue.fromJSON(j);
    return j;                                          // Guid string
  }
  return elementFromJSON(j, innerType);
}
