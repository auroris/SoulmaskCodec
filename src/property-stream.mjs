/**
 * PropertyStream: an ordered list of Property objects terminated by a
 * "None" tag. This is the recursive unit of the codec — it appears as:
 *
 *   1. The top-level body of an UnrealBlob (with a 4-byte FName.Number
 *      trailer after the None terminator).
 *   2. The value of an unknown-shape StructProperty.
 *   3. The `embedded` field of an ObjectRef.
 *   4. Each element of an ArrayProperty<StructProperty>.
 *   5. The value side of a MapProperty<_, StructProperty> entry, when the
 *      wire shape is a property stream rather than a raw 16-byte FGuid.
 *
 * The outermost stream's None tag is followed by a 4-byte FName.Number=0
 * trailer; nested streams typically aren't, except for certain Soulmask
 * embedded streams (e.g. JianZhuInstGLQComponent) that DO carry the trailer.
 * `terminatorTrailer` captures which form was on the wire so write can
 * reproduce it.
 */

import { Property, TerminatorProperty } from './property.mjs';
import { FName } from './primitives.mjs';

/**
 * Ordered list of properties terminated by a `None` tag. The recursive unit
 * of the codec: appears at the top level of an UnrealBlob, inside
 * unknown-shape StructProperty values, inside ObjectRef.embedded, and as
 * array/set/map struct elements.
 */
export class PropertyStream {
  /**
   * @param {object} [opts]
   * @param {Property[]} [opts.properties]
   * @param {boolean}    [opts.terminated]         True iff the wire data ended with a `None` tag.
   * @param {boolean}    [opts.terminatorTrailer]  True iff a 4-byte FName.Number=0 trailer followed the `None`.
   */
  constructor({ properties = [], terminated = false, terminatorTrailer = false } = {}) {
    this.properties = properties;
    this.terminated = terminated;
    this.terminatorTrailer = terminatorTrailer;
  }

  /**
   * Read properties until either a None terminator or `endOffset` is reached.
   *
   * `consumeTerminatorTrailer` is true for the outermost stream. For nested
   * streams pass false; callers (e.g. ObjectRef) that detect a trailer in
   * the embedded byte budget set `terminatorTrailer` on the resulting
   * stream after the fact (see `attachTerminatorTrailer`).
   *
   * @param {import('./io.mjs').Cursor} cursor
   * @param {number} [endOffset]  Absolute cursor offset at which to stop (default: read to EOF).
   * @param {object} [opts]
   * @param {boolean} [opts.consumeTerminatorTrailer]
   * @param {object} [opts.ctx]  Decode context (e.g. `{ strict?: boolean }`).
   * @returns {PropertyStream}
   */
  static fromReader(cursor, endOffset = Infinity, { consumeTerminatorTrailer = false, ctx = {} } = {}) {
    const properties = [];
    let terminated = false;
    let terminatorTrailer = false;
    while (cursor.pos() < endOffset && !cursor.eof()) {
      const p = Property.fromReader(cursor, ctx);
      if (p instanceof TerminatorProperty) {
        terminated = true;
        if (consumeTerminatorTrailer && cursor.pos() + 4 <= endOffset && cursor.remaining() >= 4) {
          cursor.skip(4);
          terminatorTrailer = true;
        }
        break;
      }
      properties.push(p);
    }
    return new PropertyStream({ properties, terminated, terminatorTrailer });
  }

  /**
   * Write the properties, then a None terminator. The trailer (4-byte
   * FName.Number=0) is emitted when `this.terminatorTrailer` is true OR
   * the caller passes `emitTerminatorTrailer: true` (top-level stream).
   *
   * @param {import('./io.mjs').Writer} writer
   * @param {object}  [opts]
   * @param {boolean} [opts.emitTerminatorTrailer]
   * @param {object}  [opts.ctx]
   */
  toBytes(writer, { emitTerminatorTrailer = false, ctx = {} } = {}) {
    for (const p of this.properties) p.toBytes(writer, ctx);
    new FName('None').toBytes(writer);
    if (emitTerminatorTrailer || this.terminatorTrailer) {
      writer.writeInt32(0);
    }
  }

  /** @returns {object} */
  toJSON() {
    const j = { properties: this.properties.map(p => p.toJSON()) };
    if (this.terminated) j.terminated = true;
    if (this.terminatorTrailer) j.terminatorTrailer = true;
    return j;
  }

  /**
   * @param {object} j
   * @returns {PropertyStream}
   */
  static fromJSON(j) {
    return new PropertyStream({
      properties: (j.properties ?? []).map(p => Property.fromJSON(p)),
      terminated: !!j.terminated,
      terminatorTrailer: !!j.terminatorTrailer,
    });
  }
}

/**
 * Peek the next bytes of `cursor` (without advancing): do they look like
 * the start of a PropertyTag (an FString that names a property)?
 *
 * Used inside Map<_,Struct> entry values where the wire shape is ambiguous —
 * the same 4 bytes could be the SaveNum of a property-name FString or the
 * first uint32 of an FGuid. A property name FString is:
 *   - int32 SaveNum > 0 and reasonably small (≤ 64 chars in Soulmask)
 *   - SaveNum bytes of ANSI body whose last byte is NUL
 *   - body chars (minus NUL) are identifier-safe: A-Z, a-z, 0-9, _
 *
 * Random GUID bytes effectively never satisfy this: the first uint32 is
 * ~uniform over [0, 2^32), and even when it lands in a plausible-length
 * range the printable-ASCII + NUL-terminator check eliminates the false
 * positives.
 *
 * Limitation: only matches ANSI property names (SaveNum > 0). Every
 * Soulmask property name observed in world.db is ASCII; UTF-16 property
 * names inside Map<_,Struct> would need an additional branch.
 *
 * @param {import('./io.mjs').Cursor} cursor
 * @returns {boolean}
 */
export function peekLooksLikePropertyTag(cursor) {
  if (cursor.remaining() < 8) return false;
  const off = cursor.pos();
  const len = cursor.peekInt32();
  if (len <= 1 || len > 64) return false;
  if (cursor.remaining() < 4 + len) return false;
  if (cursor.bytes[off + 4 + len - 1] !== 0) return false;  // NUL terminator
  for (let i = 0; i < len - 1; i++) {
    const b = cursor.bytes[off + 4 + i];
    const ok = b === 0x5F                         // _
            || (b >= 0x30 && b <= 0x39)            // 0-9
            || (b >= 0x41 && b <= 0x5A)            // A-Z
            || (b >= 0x61 && b <= 0x7A);           // a-z
    if (!ok) return false;
  }
  return true;
}
