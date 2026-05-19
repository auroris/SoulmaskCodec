/**
 * wscodec — pure-JS codec for Soulmask actor_data property streams.
 *
 * The library accepts uncompressed bytes (the payload that comes out of
 * Soulmask's outer LZ4 wrapper) and returns a JavaScript object tree, and
 * vice versa. It has zero runtime dependencies — LZ4 handling, SQLite
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
 * always the unsigned 0x00000002 — the negation is purely a column-side
 * convention.
 *
 * Round-trip safety: when `_dirty` is false, `serialize` returns the
 * original input bytes verbatim. When `_dirty` is true, it re-emits the
 * property stream from scratch via `writePropertyStream`. Both paths are
 * verified byte-identical against every row in a tested world.db
 * (174.6 MB, 11,667 rows; `npm test`).
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
export { StructValue, STRUCT_HANDLERS } from './structs.mjs';
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

  get kind()      { return NAME; }
  get totalSize() { return this._raw ? this._raw.length : 0; }

  /** First top-level property with the given name, or null. */
  findProperty(propName) {
    for (const p of this.properties) {
      if (p.tag && p.tag.name && p.tag.name.value === propName) return p;
    }
    return null;
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
   * and `properties` empty — callers that need a hard failure should check
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
   * Pass-through when `_dirty` is false: returns the input bytes verbatim.
   * Re-encodes from `properties` when `_dirty` is true. `bodyTrailing`, if
   * present, is appended after the None terminator + 4-byte FName.Number
   * trailer that `writePropertyStream` emits.
   */
  serialize() {
    if (!this._dirty && this._raw instanceof Uint8Array) return this._raw;

    const w = new Writer(this._raw?.length || 256);
    w.writeUint32(this.versionTag);
    writePropertyStream(w, this.properties, /*emitTerminatorTrailer=*/true);
    if (this.bodyTrailing && this.bodyTrailing.length > 0) {
      w.writeBytes(this.bodyTrailing);
    }
    return w.finalize();
  }
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
