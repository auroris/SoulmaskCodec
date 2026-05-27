/**
 * Opaque fallback for content the codec couldn't (or wouldn't) decode.
 *
 * - `OpaqueProperty` - the entire property; used when `tag.type` is
 *   unrecognized or when a top-level value decode fails.
 * - `OpaqueValue` - a sub-value inside a container (array element, map
 *   value, struct field, text body) whose own decode failed while the
 *   surrounding shape stayed intact.
 *
 * Both are plain byte-carrying containers. The decode-site policy (warn,
 * or throw under `{ strict: true }`) is enforced by `warnOrThrow` in
 * `property.mjs` at the moment the codec degrades - these classes don't
 * warn or throw on construction. That keeps JSON reconstruction silent
 * (the user already opted in by writing them to JSON in the first place).
 *
 * @module wscodec/properties/opaque
 */

import { Property, registerOpaqueFallback, warnOrThrow } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { b64encode, b64decode } from '../base64.mjs';

/**
 * Byte-carrying sub-value used when a container element fails to decode.
 */
export class OpaqueValue {
  /**
   * @param {Object} [fields]
   * @param {Uint8Array} [fields.bytes] - Captured raw bytes.
   * @param {string|null} [fields.reason=null] - Human-readable description of why decoding failed.
   */
  constructor({ bytes, reason = null } = {}) {
    this.bytes = bytes;
    this.reason = reason;
  }

  /**
   * Capture `sizeHint` bytes from `cursor` as opaque. The caller is
   * responsible for calling `warnOrThrow(ctx, ...)` first; this constructor
   * is just bytes-in, bytes-out.
   *
   * @param {Cursor} cursor
   * @param {number} sizeHint - Number of bytes to capture.
   * @param {string|null} [reason] - Human-readable explanation.
   * @returns {OpaqueValue}
   */
  static fromReader(cursor, sizeHint, reason) {
    const bytes = cursor.readBytes(sizeHint).slice();
    return new OpaqueValue({ bytes, reason });
  }

  /** @param {Writer} writer */
  toBytes(writer) {
    writer.writeBytes(this.bytes);
  }

  /** @returns {{_opaque: true, bytes: string, reason: string|null}} */
  toJSON() {
    return { _opaque: true, bytes: b64encode(this.bytes), reason: this.reason };
  }

  /**
   * @param {Object} j
   * @returns {OpaqueValue}
   */
  static fromJSON(j) {
    return new OpaqueValue({ bytes: b64decode(j.bytes), reason: j.reason ?? null });
  }

  /**
   * @param {*} j
   * @returns {boolean} True iff `j` is an `OpaqueValue` JSON record.
   */
  static isOpaqueJSON(j) {
    return j && typeof j === 'object' && !Array.isArray(j) && j._opaque === true;
  }
}

/**
 * Byte-carrying property used as the registry's fallback for unknown
 * `tag.type` values or top-level decode failures.
 */
export class OpaqueProperty extends Property {
  /**
   * @param {Object} [fields]
   * @param {PropertyTag} [fields.tag]
   * @param {Uint8Array} [fields.bytes] - Captured raw value bytes.
   * @param {string|null} [fields.reason=null]
   */
  constructor({ tag, bytes, reason = null } = {}) {
    super({ tag });
    this.bytes = bytes;
    this.reason = reason;
  }

  /**
   * Called by `Property.fromReader` as the fallback when `tag.type.value`
   * isn't in the registry - captures the value bytes verbatim and emits
   * a structured warn (or throws under strict mode).
   *
   * @param {Cursor} cursor
   * @param {PropertyTag} tag
   * @param {number} sizeHint
   * @param {Object} [ctx]
   * @returns {OpaqueProperty}
   */
  static fromReader(cursor, tag, sizeHint, ctx) {
    const reason = `Unknown property type '${tag.type.value}'`;
    warnOrThrow(ctx, `OpaqueProperty['${tag.name.value}']: ${reason} (${sizeHint} bytes)`);
    const bytes = cursor.readBytes(sizeHint).slice();
    return new this({ tag, bytes, reason });
  }

  _writeValue(writer) {
    writer.writeBytes(this.bytes);
  }

  _writeJSON(j) {
    j.bytes = b64encode(this.bytes);
    if (this.reason != null) j.reason = this.reason;
  }

  static fromJSON(j) {
    return new this({
      tag: PropertyTag.fromJSON(j),
      bytes: b64decode(j.bytes),
      reason: j.reason ?? null,
    });
  }
}

// Wire the registry so `Property.fromReader` can dispatch unknown types here.
registerOpaqueFallback(OpaqueProperty);

