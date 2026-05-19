/**
 * wscodec: pure-JS codec for Soulmask actor_data property streams.
 *
 * The library accepts uncompressed bytes (the payload that comes out of
 * Soulmask's outer LZ4 wrapper) and returns a JavaScript object tree, and
 * vice versa. It has zero runtime dependencies; LZ4 handling, SQLite
 * access, etc. are the caller's responsibility.
 *
 * Wire layout (the bytes accepted by `UnrealBlob.decode` and produced by
 * `UnrealBlob.serialize`):
 *   [0..3]   u32 LE   version tag = 0x00000002
 *   [4..]    FPropertyTag stream terminated by FString "None" + int32 0
 *
 * Soulmask actor_data envelope (handled OUTSIDE this library):
 *   [0..3]   u32 LE       outer version tag = 0x00000002
 *   [4..]    LZ4 block    size-prefixed; decompresses to the bytes above.
 *
 * The SQLite `actor_table.data_version` column stores the NEGATIVE of the
 * wire-format DataVersion. A healthy blob with DataVersion=2 lives in a row
 * whose `data_version` column reads -2. The wire bytes themselves are
 * always the unsigned 0x00000002; the negation is purely a column-side
 * convention.
 *
 * Round-trip safety: when `_dirty` is false, `serialize` returns the
 * original input bytes verbatim. When `_dirty` is true, it re-emits the
 * property stream from scratch via `writePropertyStream`. Both paths are
 * verified byte-identical against every row in a tested world.db
 * (`npm test`).
 *
 * Re-exports the most commonly used types so callers can do
 *   import { UnrealBlob, FName, FGuid, ObjectRef, ... } from 'wscodec';
 * instead of reaching into individual submodules.
 */

import { Cursor, Writer } from './io.mjs';
import { readPropertyStream, writePropertyStream } from './properties.mjs';

// Convenience re-exports for the public API surface.
export { Cursor, Writer } from './io.mjs';
export { FName, FGuid } from './primitives.mjs';
export { StructValue, STRUCT_HANDLERS, registerStructHandler } from './structs.mjs';
export { ObjectRef, SoftObjectRef, FTextValue, OpaqueValue } from './values.mjs';
export {
  PropertyTag, Property,
  ArrayValue, SetValue, MapValue,
  readPropertyStream, writePropertyStream, writeNestedPropertyStream,
  readValue, writeValue,
} from './properties.mjs';

const NAME = 'unreal-properties';
const VERSION_HEADER_SIZE = 4;
export const VERSION_TAG = 0x00000002;

export class UnrealBlob {
  constructor({
    versionTag = VERSION_TAG,
    properties = [],
    terminated = false,
    bodyTrailing = null,
    error = null,
    raw = null,
  } = {}) {
    this.versionTag = versionTag;
    this.properties = properties;
    this.terminated = terminated;
    this.bodyTrailing = bodyTrailing;
    this.error = error;
    this._raw = raw;
    this._dirty = false;
  }

  /**
   * Codec-adapter name (`'unreal-properties'`). Surfaced for registries that
   * dispatch on a codec's `kind` field; matches the `name` on the bare
   * `codec` adapter exported at the bottom of this module.
   */
  get kind() { return NAME; }

  /**
   * Number of bytes the blob was decoded from (`_raw.length`), or 0 if the
   * blob was constructed without an input buffer. NOT the post-serialize
   * size; for that, call `serialize().length`.
   */
  get totalSize() { return this._raw ? this._raw.length : 0; }

  /**
   * First TOP-LEVEL property with the given tag name, or null. Does NOT
   * traverse into embedded streams, struct values, array elements, or map
   * entries. Use `findPropertyDeep` to walk the full tree.
   */
  findProperty(propName) {
    for (const p of this.properties) {
      if (p.tag && p.tag.name && p.tag.name.value === propName) return p;
    }
    return null;
  }

  /**
   * First property with the given tag name found anywhere in the property
   * tree, or null. Performs a depth-first traversal across:
   *
   *   - top-level properties
   *   - ObjectRef.embedded streams (nested ObjectProperty values)
   *   - StructValue.value when it's a tagged property array
   *   - ArrayProperty / SetProperty struct elements
   *   - MapProperty entries: both key (if StructValue) and value
   *
   * Returns the first match in traversal order; later matches are not
   * surfaced. For all matches, walk the tree manually.
   */
  findPropertyDeep(propName) {
    return _findPropertyDeep(this.properties, propName);
  }

  static detect(u8) {
    if (!u8 || u8.length < VERSION_HEADER_SIZE) return false;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    return dv.getUint32(0, true) === VERSION_TAG;
  }

  /**
   * Parse uncompressed property-stream bytes into an UnrealBlob.
   *
   * On unrecoverable structural failure the returned blob has `error` set
   * and `properties` empty. Callers that need a hard failure should check
   * `blob.error` after decode.
   */
  static decode(u8) {
    if (!UnrealBlob.detect(u8)) {
      const head = u8 ? Array.from(u8.subarray(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ') : '(empty)';
      throw new Error(`UnrealBlob.decode: not an unreal-properties blob (header bytes: ${head})`);
    }

    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const versionTag = dv.getUint32(0, true);
    const cursor = new Cursor(u8, VERSION_HEADER_SIZE);

    let properties = [];
    let terminated = false;
    let bodyTrailing = null;
    let error = null;

    try {
      const stream = readPropertyStream(cursor, u8.length, /*consumeTerminatorTrailer=*/true);
      properties = stream.properties;
      terminated = stream.terminated;
      if (cursor.pos() < u8.length) {
        bodyTrailing = u8.slice(cursor.pos());
      }
    } catch (e) {
      error = e.message;
    }

    return new UnrealBlob({ versionTag, properties, terminated, bodyTrailing, error, raw: u8 });
  }

  /**
   * Return the uncompressed property-stream bytes for this blob.
   *
   * Pass-through when `_dirty` is false: returns the input bytes verbatim,
   * even if `error` is set (the original bytes round-trip even when decode
   * was incomplete). Re-encodes from `properties` when `_dirty` is true,
   * appending `bodyTrailing` after the None terminator + 4-byte FName.Number
   * trailer that `writePropertyStream` emits.
   *
   * Throws if `_dirty` is true AND `error` is set: re-emitting would produce
   * a malformed stream (the property tree is empty after a structural
   * failure). Clear `.error` first if you intentionally want to emit from
   * an externally-constructed properties array.
   */
  serialize() {
    if (!this._dirty && this._raw instanceof Uint8Array) return this._raw;

    if (this.error != null) {
      throw new Error(
        `UnrealBlob.serialize: cannot re-emit a blob with decode error (${this.error}). ` +
        `Leave _dirty=false to pass through _raw verbatim, or clear .error if you've replaced .properties manually.`
      );
    }

    const w = new Writer(this._raw?.length || 256);
    w.writeUint32(this.versionTag);
    writePropertyStream(w, this.properties, /*emitTerminatorTrailer=*/true);
    if (this.bodyTrailing && this.bodyTrailing.length > 0) {
      w.writeBytes(this.bodyTrailing);
    }
    return w.finalize();
  }
}

// Deep-search helper. Walks the property tree in depth-first order and
// returns the first Property whose tag.name matches. Kept out of the class
// body so the recursion can reach into nested shapes uniformly without
// having to thread `this` around.
function _findPropertyDeep(properties, propName) {
  if (!Array.isArray(properties)) return null;
  for (const p of properties) {
    if (p.tag && p.tag.name && p.tag.name.value === propName) return p;
    const v = p.value;
    if (v == null) continue;
    // ObjectRef with embedded property stream.
    if (v.embedded) {
      const hit = _findPropertyDeep(v.embedded, propName);
      if (hit) return hit;
    }
    // StructValue: .value is either a property array (unknown struct) or a
    // plain binary record (known struct). Only the array form is searchable.
    if (v._structName && Array.isArray(v.value)) {
      const hit = _findPropertyDeep(v.value, propName);
      if (hit) return hit;
    }
    // ArrayProperty / SetProperty struct elements + ObjectRef embeddeds.
    if (Array.isArray(v.elements)) {
      for (const e of v.elements) {
        if (e && e._structName && Array.isArray(e.value)) {
          const hit = _findPropertyDeep(e.value, propName);
          if (hit) return hit;
        }
        if (e && e.embedded) {
          const hit = _findPropertyDeep(e.embedded, propName);
          if (hit) return hit;
        }
      }
    }
    // MapProperty entries: both key (if StructValue) and value can hold a
    // nested property stream.
    if (Array.isArray(v.entries)) {
      for (const ent of v.entries) {
        if (ent.key && ent.key._structName && Array.isArray(ent.key.value)) {
          const hit = _findPropertyDeep(ent.key.value, propName);
          if (hit) return hit;
        }
        const ev = ent.value;
        if (ev && ev._structName && Array.isArray(ev.value)) {
          const hit = _findPropertyDeep(ev.value, propName);
          if (hit) return hit;
        }
      }
    }
  }
  return null;
}

// Generic codec-adapter shape (name + detect + decode + encode), suitable
// for plugging into any registry that uses that quartet. Operates on the
// uncompressed bytes that `UnrealBlob.decode` accepts; for callers reading
// Soulmask's actor_data column directly, wrap this with the column's outer
// LZ4 envelope (4-byte version tag + size-prefixed LZ4 block).
export const codec = {
  name: NAME,
  detect: u8 => UnrealBlob.detect(u8),
  decode: u8 => UnrealBlob.decode(u8),
  encode: blob => blob.serialize(),
};
