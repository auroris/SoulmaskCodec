/**
 * Opaque fallback for content the codec couldn't (or wouldn't) decode.
 *
 *   OpaqueProperty  — the entire property; used when tag.type is unrecognized
 *                     or when a top-level value decode fails.
 *   OpaqueValue     — a sub-value inside a container (array element, map
 *                     value, struct field, text body) whose own decode failed
 *                     while the surrounding shape stayed intact.
 *
 * Both are plain byte-carrying containers. The decode-site policy (warn,
 * or throw under `{ strict: true }`) is enforced by `warnOrThrow` in
 * property.mjs at the moment the codec degrades — these classes don't
 * warn or throw on construction. That keeps JSON reconstruction silent
 * (the user already opted in by writing them to JSON in the first place).
 */

import { Property, registerOpaqueFallback, warnOrThrow } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { b64encode, b64decode } from '../base64.mjs';

export class OpaqueValue {
  constructor({ bytes, reason = null } = {}) {
    this.bytes = bytes;
    this.reason = reason;
  }

  /**
   * Capture `sizeHint` bytes from `cursor` as opaque. The caller is
   * responsible for calling `warnOrThrow(ctx, ...)` first; this constructor
   * is just bytes-in, bytes-out.
   */
  static fromReader(cursor, sizeHint, reason) {
    const bytes = cursor.readBytes(sizeHint).slice();
    return new OpaqueValue({ bytes, reason });
  }

  toBytes(writer) {
    writer.writeBytes(this.bytes);
  }

  toJSON() {
    return { _opaque: true, bytes: b64encode(this.bytes), reason: this.reason };
  }

  static fromJSON(j) {
    return new OpaqueValue({ bytes: b64decode(j.bytes), reason: j.reason ?? null });
  }

  static isOpaqueJSON(j) {
    return j && typeof j === 'object' && !Array.isArray(j) && j._opaque === true;
  }
}

export class OpaqueProperty extends Property {
  constructor({ tag, bytes, reason = null } = {}) {
    super({ tag });
    this.bytes = bytes;
    this.reason = reason;
  }

  /**
   * Called by `Property.fromReader` as the fallback when `tag.type.value`
   * isn't in the registry — captures the value bytes verbatim and emits
   * a structured warn (or throws under strict mode).
   */
  static fromReader(cursor, tag, sizeHint, ctx) {
    const reason = `Unknown property type '${tag.type.value}'`;
    warnOrThrow(ctx, `OpaqueProperty['${tag.name.value}']: ${reason} (${sizeHint} bytes)`);
    const bytes = cursor.readBytes(sizeHint).slice();
    return new OpaqueProperty({ tag, bytes, reason });
  }

  _writeValue(writer) {
    writer.writeBytes(this.bytes);
  }

  _writeJSON(j) {
    j.bytes = b64encode(this.bytes);
    if (this.reason != null) j.reason = this.reason;
  }

  static fromJSON(j) {
    const tag = PropertyTag.fromJSON(j);
    return new OpaqueProperty({
      tag,
      bytes: b64decode(j.bytes),
      reason: j.reason ?? null,
    });
  }
}

// Wire the registry so `Property.fromReader` can dispatch unknown types here.
registerOpaqueFallback(OpaqueProperty);

