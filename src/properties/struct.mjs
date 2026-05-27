/**
 * StructProperty + StructValue + the binary-struct handler registry.
 *
 * A struct on the wire is one of two forms:
 *
 *   "binary"     — well-known UE struct (Vector, Quat, FColor, etc.) with
 *                  a fixed-layout binary record. Handler reads/writes a
 *                  plain object (e.g. {x, y, z}) directly.
 *
 *   "propStream" — unknown or property-tagged struct: a nested
 *                  PropertyStream terminated by None. Always falls through
 *                  to here when no handler is registered; ALSO selected for
 *                  known-binary structs when the peek heuristic says the
 *                  next bytes are a PropertyTag (Soulmask encodes some
 *                  known-binary structs as tagged streams inside Map struct
 *                  values, which would otherwise be misread as raw records).
 *
 *   "decodeError" — non-strict-mode fallback when the propStream read
 *                  throws mid-decode. Captures the remaining tail bytes as
 *                  opaque so the surrounding stream stays aligned.
 *
 * The same `StructValue` class is used both as `StructProperty.value` and
 * as the element type of `ArrayProperty<StructProperty>` / the value side
 * of `MapProperty<_, StructProperty>`.
 *
 * FColor wire order is B, G, R, A (not R, G, B, A). This matches UE4's
 * FColor::Serialize, where the in-memory union exposes the bytes in BGRA
 * order to match Windows DIB / DirectX texture layout.
 *
 * 64-bit integers (DateTime, Timespan) are exchanged as decimal strings;
 * `Writer.writeInt64` accepts string/BigInt/safe-integer-Number.
 */

import { Property, registerProperty, warnOrThrow } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { PropertyStream, peekLooksLikePropertyTag } from '../property-stream.mjs';
import { FGuid } from '../primitives.mjs';
import { b64encode, b64decode } from '../base64.mjs';

// ── STRUCT_HANDLERS registry ────────────────────────────────────────────────
export const STRUCT_HANDLERS = {
  Vector:      { read: c => ({ x: c.readFloat32(), y: c.readFloat32(), z: c.readFloat32() }),
                 write: (w, v) => { w.writeFloat32(v.x); w.writeFloat32(v.y); w.writeFloat32(v.z); } },
  Vector2D:    { read: c => ({ x: c.readFloat32(), y: c.readFloat32() }),
                 write: (w, v) => { w.writeFloat32(v.x); w.writeFloat32(v.y); } },
  Vector4:     { read: c => ({ x: c.readFloat32(), y: c.readFloat32(), z: c.readFloat32(), w: c.readFloat32() }),
                 write: (w, v) => { w.writeFloat32(v.x); w.writeFloat32(v.y); w.writeFloat32(v.z); w.writeFloat32(v.w); } },
  Rotator:     { read: c => ({ pitch: c.readFloat32(), yaw: c.readFloat32(), roll: c.readFloat32() }),
                 write: (w, v) => { w.writeFloat32(v.pitch); w.writeFloat32(v.yaw); w.writeFloat32(v.roll); } },
  Quat:        { read: c => ({ x: c.readFloat32(), y: c.readFloat32(), z: c.readFloat32(), w: c.readFloat32() }),
                 write: (w, v) => { w.writeFloat32(v.x); w.writeFloat32(v.y); w.writeFloat32(v.z); w.writeFloat32(v.w); } },
  // FColor wire order is BGRA (see header note); don't "fix" the ordering.
  Color:       { read: c => ({ b: c.readUint8(), g: c.readUint8(), r: c.readUint8(), a: c.readUint8() }),
                 write: (w, v) => { w.writeUint8(v.b); w.writeUint8(v.g); w.writeUint8(v.r); w.writeUint8(v.a); } },
  LinearColor: { read: c => ({ r: c.readFloat32(), g: c.readFloat32(), b: c.readFloat32(), a: c.readFloat32() }),
                 write: (w, v) => { w.writeFloat32(v.r); w.writeFloat32(v.g); w.writeFloat32(v.b); w.writeFloat32(v.a); } },
  // Guid: read returns an FGuid INSTANCE (toJSON/equals/isZero helpers on
  // the result); write accepts an FGuid or a bare 8-4-4-4-12 string.
  Guid:        { read: c => FGuid.fromReader(c),
                 write: (w, v) => FGuid.from(v).toBytes(w) },
  DateTime:    { read: c => c.readInt64().toString(),
                 write: (w, v) => w.writeInt64(v) },
  Timespan:    { read: c => c.readInt64().toString(),
                 write: (w, v) => w.writeInt64(v) },
  IntPoint:    { read: c => ({ x: c.readInt32(), y: c.readInt32() }),
                 write: (w, v) => { w.writeInt32(v.x); w.writeInt32(v.y); } },
  IntVector:   { read: c => ({ x: c.readInt32(), y: c.readInt32(), z: c.readInt32() }),
                 write: (w, v) => { w.writeInt32(v.x); w.writeInt32(v.y); w.writeInt32(v.z); } },
  Box:         { read: c => ({ min: STRUCT_HANDLERS.Vector.read(c), max: STRUCT_HANDLERS.Vector.read(c), isValid: c.readUint8() }),
                 write: (w, v) => { STRUCT_HANDLERS.Vector.write(w, v.min); STRUCT_HANDLERS.Vector.write(w, v.max); w.writeUint8(v.isValid); } },
  Sphere:      { read: c => ({ center: STRUCT_HANDLERS.Vector.read(c), radius: c.readFloat32() }),
                 write: (w, v) => { STRUCT_HANDLERS.Vector.write(w, v.center); w.writeFloat32(v.radius); } },
  Plane:       { read: c => ({ x: c.readFloat32(), y: c.readFloat32(), z: c.readFloat32(), w: c.readFloat32() }),
                 write: (w, v) => { w.writeFloat32(v.x); w.writeFloat32(v.y); w.writeFloat32(v.z); w.writeFloat32(v.w); } },
  Transform:   { read: c => ({ rotation: STRUCT_HANDLERS.Quat.read(c), translation: STRUCT_HANDLERS.Vector.read(c), scale3D: STRUCT_HANDLERS.Vector.read(c) }),
                 write: (w, v) => { STRUCT_HANDLERS.Quat.write(w, v.rotation); STRUCT_HANDLERS.Vector.write(w, v.translation); STRUCT_HANDLERS.Vector.write(w, v.scale3D); } },
};

/**
 * Register (or replace) a struct handler. Use this rather than mutating
 * STRUCT_HANDLERS directly; this validates handler shape. Without a
 * handler, an unknown struct name falls through to the property-stream
 * path.
 */
export function registerStructHandler(name, handler) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('registerStructHandler: name must be a non-empty string');
  }
  if (!handler || typeof handler.read !== 'function' || typeof handler.write !== 'function') {
    throw new TypeError('registerStructHandler: handler must expose read(cursor) and write(writer, value) functions');
  }
  STRUCT_HANDLERS[name] = handler;
}

// ── StructValue ─────────────────────────────────────────────────────────────
export class StructValue {
  constructor(structName, {
    form = null,
    binaryValue = null,
    stream = null,
    decodeError = null,
    opaqueTail = null,
  } = {}) {
    this.structName = structName;
    // Form discriminator: 'binary' | 'propStream' | 'decodeError'. Settled
    // at construction time and used by toBytes/toJSON to dispatch.
    this.form = form;
    this.binaryValue = binaryValue;   // plain object/string/FGuid for known-binary form
    this.stream = stream;             // PropertyStream for propStream form
    this.decodeError = decodeError;
    this.opaqueTail = opaqueTail;
  }

  get isKnownBinary() { return STRUCT_HANDLERS[this.structName] != null; }

  /**
   * Read a struct value. `peekTagged` controls whether the peek heuristic
   * is consulted before dispatching to a registered binary handler — used
   * inside Map<_,Struct> value reads where Soulmask encodes some
   * known-binary structs as tagged streams.
   */
  static fromReader(cursor, structName, sizeHint, ctx, { peekTagged = false } = {}) {
    const handler = STRUCT_HANDLERS[structName];
    if (handler && (!peekTagged || !peekLooksLikePropertyTag(cursor))) {
      return new StructValue(structName, { form: 'binary', binaryValue: handler.read(cursor) });
    }
    const startOff = cursor.pos();
    try {
      const stream = PropertyStream.fromReader(cursor, isFinite(sizeHint) ? startOff + sizeHint : Infinity, { ctx });
      return new StructValue(structName, { form: 'propStream', stream });
    } catch (e) {
      // Snapshot the full element wire bytes for verbatim re-emit, then
      // park the cursor exactly at the expected element end. The inner
      // decode may have overrun the budget (cursor past startOff+sizeHint)
      // if it tripped on a bad length read — without the seek, the caller's
      // per-element bookkeeping would inherit a corrupt cursor position.
      // Capturing the whole element (not just the unread tail) is what
      // lets the writer reproduce the original bytes when this StructValue
      // is the only thing emitted in decodeError form.
      let opaqueTail = null;
      if (isFinite(sizeHint)) {
        const end = startOff + sizeHint;
        opaqueTail = cursor.bytes.subarray(startOff, end).slice();
        cursor.seek(end);
      }
      warnOrThrow(ctx, `StructValue<${structName}>: decode failed: ${e.message}`);
      return new StructValue(structName, { form: 'decodeError', decodeError: e.message, opaqueTail });
    }
  }

  /**
   * Read a struct value WITHOUT consulting STRUCT_HANDLERS (always uses
   * the property-stream path). Used by Map<Struct,Struct> entry values
   * once the peek heuristic has decided the bytes are tagged.
   */
  static fromReaderTagged(cursor, structName, ctx) {
    const stream = PropertyStream.fromReader(cursor, Infinity, { ctx });
    return new StructValue(structName, { form: 'propStream', stream });
  }

  toBytes(writer, ctx = {}) {
    if (this.form === 'binary') {
      const handler = STRUCT_HANDLERS[this.structName];
      if (!handler) throw new Error(`StructValue.toBytes: form='binary' but no handler for '${this.structName}'`);
      handler.write(writer, this.binaryValue);
      return;
    }
    if (this.form === 'propStream') {
      this.stream.toBytes(writer, { ctx });
      return;
    }
    if (this.form === 'decodeError') {
      if (this.opaqueTail) writer.writeBytes(this.opaqueTail);
      return;
    }
    throw new Error(`StructValue.toBytes: unknown form '${this.form}'`);
  }

  /**
   * Write the property-stream BODY only (no None terminator). Used by
   * Map<_, StructProperty> entry values where the surrounding writer
   * emits its own terminator.
   *
   * Currently unused — Map's writer goes through the stream's toBytes
   * which DOES emit None. Kept for symmetry should we need a no-None form.
   */

  toJSON() {
    if (this.form === 'decodeError') {
      return {
        form: 'decodeError',
        structName: this.structName,
        error: this.decodeError,
        opaqueTail: this.opaqueTail ? b64encode(this.opaqueTail) : null,
      };
    }
    if (this.form === 'propStream') {
      return {
        form: 'propStream',
        structName: this.structName,
        stream: this.stream.toJSON(),
      };
    }
    // 'binary' form. Special-case value shapes that aren't plain objects.
    let v = this.binaryValue;
    if (v instanceof FGuid) v = v.value;
    return { form: 'binary', structName: this.structName, value: v };
  }

  static fromJSON(j) {
    const structName = j.structName;
    if (j.form === 'decodeError') {
      return new StructValue(structName, {
        form: 'decodeError',
        decodeError: j.error,
        opaqueTail: j.opaqueTail ? b64decode(j.opaqueTail) : null,
      });
    }
    if (j.form === 'propStream') {
      return new StructValue(structName, {
        form: 'propStream',
        stream: PropertyStream.fromJSON(j.stream),
      });
    }
    if (j.form === 'binary') {
      let val = j.value;
      if (structName === 'Guid' && typeof val === 'string') val = new FGuid(val);
      return new StructValue(structName, { form: 'binary', binaryValue: val });
    }
    throw new Error(`StructValue.fromJSON: unknown form '${j.form}'`);
  }
}

// ── StructProperty ──────────────────────────────────────────────────────────
export class StructProperty extends Property {
  constructor({ tag, value = null } = {}) {
    super({ tag });
    this.value = value;  // StructValue
  }

  static fromReader(cursor, tag, sizeHint, ctx) {
    // `peekTagged: true` matches Soulmask's habit of writing some known-
    // binary structs (e.g. RelativeTransform) as tagged property streams
    // anyway. Without the peek the binary handler reads its 40 bytes and
    // the remaining 213 bytes of the property-stream form trip the
    // size-mismatch check.
    const value = StructValue.fromReader(cursor, tag.structName.value, sizeHint, ctx, { peekTagged: true });
    return new StructProperty({ tag, value });
  }

  _writeValue(w, ctx) { this.value.toBytes(w, ctx); }

  _writeJSON(j) { j.value = this.value.toJSON(); }

  static fromJSON(j) {
    return new StructProperty({ tag: PropertyTag.fromJSON(j), value: StructValue.fromJSON(j.value) });
  }
}

registerProperty('StructProperty', StructProperty);

