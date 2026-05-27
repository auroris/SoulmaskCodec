/**
 * `SoftObjectProperty` / `SoftClassProperty`.
 *
 * Wire shape: two consecutive FStrings - `assetPath`, then `subPath`. Empty
 * sub-paths are common; non-empty entries point inside a level / sublevel.
 *
 * `SoftObjectRef` is the value type. It's a class (not a plain
 * `{assetPath, subPath}` object) for symmetry with `ObjectRef` and so future
 * extension (e.g. caching the parsed asset path) has somewhere to live.
 *
 * @module wscodec/properties/soft-object
 */

import { Property, registerProperty } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';

/**
 * Decoded `SoftObjectProperty` value: a pair of FStrings naming an asset
 * and an optional sub-path inside that asset.
 */
export class SoftObjectRef {
  /**
   * @param {Object} [fields]
   * @param {string} [fields.assetPath='']
   * @param {string} [fields.subPath='']
   */
  constructor({ assetPath = '', subPath = '' } = {}) {
    this.assetPath = assetPath;
    this.subPath = subPath;
  }

  /**
   * @param {Cursor} cursor
   * @returns {SoftObjectRef}
   */
  static fromReader(cursor) {
    return new SoftObjectRef({
      assetPath: cursor.readFString().value,
      subPath: cursor.readFString().value,
    });
  }

  /** @param {Writer} writer */
  toBytes(writer) {
    writer.writeFString(this.assetPath);
    writer.writeFString(this.subPath);
  }

  /** @returns {{assetPath: string, subPath: string}} */
  toJSON() { return { assetPath: this.assetPath, subPath: this.subPath }; }

  /**
   * @param {{assetPath: string, subPath: string}} j
   * @returns {SoftObjectRef}
   */
  static fromJSON(j) { return new SoftObjectRef({ assetPath: j.assetPath, subPath: j.subPath }); }
}

/**
 * Property wrapping a `SoftObjectRef`.
 */
export class SoftObjectProperty extends Property {
  /**
   * @param {Object} [fields]
   * @param {PropertyTag} [fields.tag]
   * @param {SoftObjectRef|null} [fields.value=null]
   */
  constructor({ tag, value = null } = {}) {
    super({ tag });
    this.value = value;   // SoftObjectRef
  }
  static fromReader(cursor, tag) {
    return new SoftObjectProperty({ tag, value: SoftObjectRef.fromReader(cursor) });
  }
  _writeValue(w) { this.value.toBytes(w); }
  _writeJSON(j) { j.value = this.value.toJSON(); }
  static fromJSON(j) {
    return new SoftObjectProperty({ tag: PropertyTag.fromJSON(j), value: SoftObjectRef.fromJSON(j.value) });
  }
}

/**
 * Same wire layout as `SoftObjectProperty` (UE just uses a different
 * declared type in the tag). Subclass for `tag.type` symmetry.
 */
export class SoftClassProperty extends SoftObjectProperty {
  static fromReader(cursor, tag) {
    return new SoftClassProperty({ tag, value: SoftObjectRef.fromReader(cursor) });
  }
  static fromJSON(j) {
    return new SoftClassProperty({ tag: PropertyTag.fromJSON(j), value: SoftObjectRef.fromJSON(j.value) });
  }
}

registerProperty('SoftObjectProperty', SoftObjectProperty);
registerProperty('SoftClassProperty', SoftClassProperty);
