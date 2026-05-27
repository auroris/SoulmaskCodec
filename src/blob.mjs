/**
 * UnrealBlob: top-level entry point for the wscodec.
 *
 *   UnrealBlob.fromBytes(u8, opts)   → parse uncompressed property-stream bytes
 *   blob.toBytes()                   → re-encode to bytes
 *   UnrealBlob.fromJSON(j)           → reconstruct from a structured JSON tree
 *   blob.toJSON()                    → produce a JSON-safe tree
 *   UnrealBlob.fromJSONString(s)     → parse + reconstruct from a JSON string
 *                                      (handles -0 / NaN / Infinity via sentinels)
 *   blob.toJSONString(indent)        → stringify with sentinel substitution
 *
 * Wire layout (bytes accepted by `fromBytes` and produced by `toBytes`):
 *   [0..3]   u32 LE   versionTag = 0x00000002
 *   [4..]    FPropertyTag stream terminated by "None" + int32 0 trailer
 *
 * Soulmask actor_data envelope (handled OUTSIDE this library):
 *   [0..3]   u32 LE       outer version tag = 0x00000002
 *   [4..]    LZ4 block    size-prefixed; decompresses to the bytes above.
 *
 * The SQLite `actor_table.data_version` column stores the NEGATIVE of the
 * wire-format DataVersion. A healthy blob with DataVersion=2 lives in a row
 * whose `data_version` column reads -2. The wire bytes themselves are always
 * the unsigned 0x00000002; the negation is purely a column-side convention.
 *
 * `fromBytes` accepts an `opts.strict` flag. When true, every opaque
 * fallback (unknown property type, decode failure inside a container,
 * unimplemented FText historyType, delegate property family) throws
 * instead of warning + capturing bytes. Default behavior is to warn via
 * `console.warn` and keep going.
 */

import { Cursor, Writer } from './io.mjs';
import { PropertyStream } from './property-stream.mjs';
import { b64encode, b64decode } from './base64.mjs';

// Side-effect imports populate PROPERTY_REGISTRY. Order doesn't matter as
// long as every property file is loaded before the first `fromBytes` /
// `fromJSON` call. Importing UnrealBlob (i.e. this file) is the
// canonical way to ensure that.
import './properties/leaf.mjs';
import './properties/opaque.mjs';
import './properties/soft-object.mjs';
import './properties/object.mjs';
import './properties/struct.mjs';
import './properties/text.mjs';
import './properties/array.mjs';
import './properties/set.mjs';
import './properties/map.mjs';
import './properties/delegate.mjs';

const NAME = 'unreal-properties';
const VERSION_HEADER_SIZE = 4;
export const VERSION_TAG = 0x00000002;

export class UnrealBlob {
  constructor({ versionTag = VERSION_TAG, stream = null, bodyTrailing = null } = {}) {
    this.versionTag = versionTag;
    this.stream = stream ?? new PropertyStream({ properties: [], terminated: false });
    this.bodyTrailing = bodyTrailing;
  }

  /** Codec-adapter name. Matches the `name` field on the bare `codec` export. */
  get kind() { return NAME; }

  /**
   * Convenience accessor for the top-level property list. Equivalent to
   * `this.stream.properties` — exposes the canonical place to add/remove
   * properties at the top level.
   */
  get properties() { return this.stream.properties; }

  /** True iff the property stream was successfully terminated by a None tag. */
  get terminated() { return this.stream.terminated; }

  /**
   * First TOP-LEVEL property with the given tag name, or null. Does NOT
   * traverse into embedded streams, struct values, array elements, or map
   * entries — use `findPropertyDeep` for that.
   */
  findProperty(propName) {
    for (const p of this.stream.properties) {
      if (p.name === propName) return p;
    }
    return null;
  }

  /**
   * Depth-first search for the first property with the given tag name,
   * anywhere in the tree. Walks:
   *   - top-level properties
   *   - ObjectRef.embedded (PropertyStream)
   *   - StructValue's propStream form
   *   - ArrayProperty / SetProperty StructValue elements + ObjectRef embeddeds
   *   - MapProperty entries: both key (when StructValue) and value
   */
  findPropertyDeep(propName) {
    return _findPropertyDeep(this.stream.properties, propName);
  }

  /**
   * True iff `u8` starts with the wscodec wire header. Cheap header sniff;
   * doesn't validate the rest of the structure.
   */
  static detect(u8) {
    if (!u8 || u8.length < VERSION_HEADER_SIZE) return false;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    return dv.getUint32(0, true) === VERSION_TAG;
  }

  /**
   * Parse uncompressed property-stream bytes. Always throws on size
   * mismatch (codec bug) or any other structural failure; the
   * `opts.strict` flag additionally escalates every opaque-fallback site
   * (unknown property type, FText unknown historyType, etc.) into a thrown
   * Error rather than a warn-and-capture.
   */
  static fromBytes(u8, opts = {}) {
    if (!UnrealBlob.detect(u8)) {
      const head = u8
        ? Array.from(u8.subarray(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')
        : '(empty)';
      throw new Error(`UnrealBlob.fromBytes: not an unreal-properties blob (header bytes: ${head})`);
    }

    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const versionTag = dv.getUint32(0, true);
    const cursor = new Cursor(u8, VERSION_HEADER_SIZE);
    const ctx = { strict: !!opts.strict };

    const stream = PropertyStream.fromReader(cursor, u8.length, {
      consumeTerminatorTrailer: true,
      ctx,
    });

    let bodyTrailing = null;
    if (cursor.pos() < u8.length) {
      bodyTrailing = u8.slice(cursor.pos());
    }

    return new UnrealBlob({ versionTag, stream, bodyTrailing });
  }

  /**
   * Re-encode this blob to bytes. Always recomputes every tag size from
   * actually-encoded value bytes; there is no pass-through path.
   */
  toBytes() {
    const w = new Writer(this.bodyTrailing ? 256 + this.bodyTrailing.length : 256);
    w.writeUint32(this.versionTag);
    this.stream.toBytes(w, { emitTerminatorTrailer: true });
    if (this.bodyTrailing && this.bodyTrailing.length > 0) {
      w.writeBytes(this.bodyTrailing);
    }
    return w.finalize();
  }

  toJSON() {
    const j = {
      versionTag: this.versionTag,
      stream: this.stream.toJSON(),
    };
    if (this.bodyTrailing && this.bodyTrailing.length > 0) {
      j.bodyTrailing = b64encode(this.bodyTrailing);
    }
    return j;
  }

  static fromJSON(j) {
    return new UnrealBlob({
      versionTag: j.versionTag,
      stream: PropertyStream.fromJSON(j.stream),
      bodyTrailing: j.bodyTrailing ? b64decode(j.bodyTrailing) : null,
    });
  }

  /** Stringify with -0 / NaN / Infinity preserved via sentinel substitution. */
  toJSONString(indent) { return JSON.stringify(this.toJSON(), jsonReplacer, indent); }

  /** Parse + reconstruct, undoing the sentinel substitution. */
  static fromJSONString(s) { return UnrealBlob.fromJSON(JSON.parse(s, jsonReviver)); }
}

// ── Codec-adapter shape (name + detect + decode + encode) ───────────────────
// Suitable for plugging into a registry that dispatches codecs by `name`.
// Operates on the uncompressed bytes that `UnrealBlob.fromBytes` accepts;
// callers reading Soulmask's actor_data column directly wrap this with the
// column's outer LZ4 envelope.
export const codec = {
  name: NAME,
  detect: u8 => UnrealBlob.detect(u8),
  decode: u8 => UnrealBlob.fromBytes(u8),
  encode: blob => blob.toBytes(),
};

// ── -0 / NaN / Infinity preservation ────────────────────────────────────────
// JSON drops sign on negative zero (`JSON.stringify(-0) === "0"`) and turns
// non-finite numbers into `null`. UE serializes them verbatim, so any of
// these in the data round-trips as a different bit pattern unless we
// intervene. We substitute a sentinel string at stringify time and reverse
// it at parse time, via JSON.stringify's replacer / JSON.parse's reviver.
//
// The sentinel surface is space-bounded to make accidental collision with
// a real string vanishingly unlikely. If you ever see a string field
// containing these exact literals in your data, audit this list first.
const NEG_ZERO_SENTINEL = ' __wscodec_neg_zero__ ';
const POS_INF_SENTINEL  = ' __wscodec_pos_inf__ ';
const NEG_INF_SENTINEL  = ' __wscodec_neg_inf__ ';
const NAN_SENTINEL      = ' __wscodec_nan__ ';

/**
 * `JSON.stringify` replacer that substitutes sentinels for -0 / Infinity /
 * NaN. Pass this to any `JSON.stringify` call that may contain
 * wscodec-derived numbers (including a blob nested inside a larger
 * envelope). Use `jsonReviver` on the matching `JSON.parse` to invert.
 */
export function jsonReplacer(_key, value) {
  if (typeof value !== 'number') return value;
  if (Object.is(value, -0))  return NEG_ZERO_SENTINEL;
  if (value === Infinity)    return POS_INF_SENTINEL;
  if (value === -Infinity)   return NEG_INF_SENTINEL;
  if (Number.isNaN(value))   return NAN_SENTINEL;
  return value;
}

/** Inverse of `jsonReplacer`. Pass to `JSON.parse(text, jsonReviver)`. */
export function jsonReviver(_key, value) {
  if (typeof value !== 'string') return value;
  switch (value) {
    case NEG_ZERO_SENTINEL: return -0;
    case POS_INF_SENTINEL:  return Infinity;
    case NEG_INF_SENTINEL:  return -Infinity;
    case NAN_SENTINEL:      return NaN;
    default: return value;
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────
function _findPropertyDeep(properties, propName) {
  if (!Array.isArray(properties)) return null;
  for (const p of properties) {
    if (p.name === propName) return p;
    const hit = _searchInsideProperty(p, propName);
    if (hit) return hit;
  }
  return null;
}

function _searchInsideProperty(p, propName) {
  // ObjectProperty / aliases: search ObjectRef.embedded
  if (p.value && p.value.embedded && p.value.embedded.properties) {
    const hit = _findPropertyDeep(p.value.embedded.properties, propName);
    if (hit) return hit;
  }
  // StructProperty: propStream form has a stream; binary form is opaque to search.
  if (p.value && p.value.form === 'propStream') {
    const hit = _findPropertyDeep(p.value.stream.properties, propName);
    if (hit) return hit;
  }
  // Array/Set elements: nested struct or nested ObjectRef
  if (Array.isArray(p.elements)) {
    for (const e of p.elements) {
      if (e && e.form === 'propStream') {
        const hit = _findPropertyDeep(e.stream.properties, propName);
        if (hit) return hit;
      }
      if (e && e.embedded) {
        const hit = _findPropertyDeep(e.embedded.properties, propName);
        if (hit) return hit;
      }
    }
  }
  // Map entries: keys (StructValue) and values (StructValue or other)
  if (Array.isArray(p.entries)) {
    for (const ent of p.entries) {
      if (ent.key && ent.key.form === 'propStream') {
        const hit = _findPropertyDeep(ent.key.stream.properties, propName);
        if (hit) return hit;
      }
      if (ent.value && ent.value.form === 'propStream') {
        const hit = _findPropertyDeep(ent.value.stream.properties, propName);
        if (hit) return hit;
      }
    }
  }
  return null;
}

