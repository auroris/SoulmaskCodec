/**
 * SoftObjectProperty / SoftClassProperty.
 *
 * Wire shape: two consecutive FStrings — assetPath, then subPath. Empty
 * subPaths are common; non-empty entries point inside a level / sublevel.
 *
 * `SoftObjectRef` is the value type. It's a class (not a plain {assetPath,
 * subPath} object) for symmetry with `ObjectRef` and so future extension
 * (e.g. caching the parsed asset path) has somewhere to live.
 */

import { Property, registerProperty } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';

/**
 * Decoded SoftObjectProperty value: an `assetPath` plus an optional `subPath`
 * pointing inside a level / sublevel.
 */
export class SoftObjectRef {
  /**
   * @param {object} [opts]
   * @param {string} [opts.assetPath]
   * @param {string} [opts.subPath]
   */
  constructor({ assetPath = '', subPath = '' } = {}) {
    this.assetPath = assetPath;
    this.subPath = subPath;
  }

  /**
   * @param {import('../io.mjs').Cursor} cursor
   * @returns {SoftObjectRef}
   */
  static fromReader(cursor) {
    return new SoftObjectRef({
      assetPath: cursor.readFString().value,
      subPath: cursor.readFString().value,
    });
  }

  /** @param {import('../io.mjs').Writer} writer */
  toBytes(writer) {
    writer.writeFString(this.assetPath);
    writer.writeFString(this.subPath);
  }

  toJSON() { return { assetPath: this.assetPath, subPath: this.subPath }; }
  /**
   * @param {{assetPath: string, subPath: string}} j
   * @returns {SoftObjectRef}
   */
  static fromJSON(j) { return new SoftObjectRef({ assetPath: j.assetPath, subPath: j.subPath }); }
}

/**
 * UE SoftObjectProperty: a soft (asset-path-based) reference. Value is a
 * {@link SoftObjectRef}.
 */
export class SoftObjectProperty extends Property {
  /**
   * @param {object} [opts]
   * @param {import('../tag.mjs').PropertyTag} [opts.tag]
   * @param {SoftObjectRef|null} [opts.value]
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
 * UE SoftClassProperty: identical wire layout to {@link SoftObjectProperty};
 * separate class so `tag.type` round-trips faithfully.
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
