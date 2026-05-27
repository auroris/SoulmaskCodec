/**
 * ObjectProperty (and its aliases) + the ObjectRef value class.
 *
 * Aliased property tags that all wrap an ObjectRef:
 *   ObjectProperty, ClassProperty, WeakObjectProperty, LazyObjectProperty,
 *   WSObjectProperty (Soulmask alias)
 *
 * Soulmask's ObjectProperty wire shape is variable; the reader uses the
 * tag's size budget to decide which of these shapes is on the wire:
 *
 *   u8       kind             always present
 *   u32      kindOnePrefix    ONLY when kind === 0x01 (Soulmask). The
 *                             observed value is always 1; semantic
 *                             unknown. Captured verbatim and replayed.
 *                             Seen on hard actor references like NPC
 *                             `HBindBGCompActor` (pawn → inventory link).
 *   FString  path             present iff budget remains
 *   FString  classPath        present iff budget remains
 *   stream   embedded         present iff budget remains; terminated by None,
 *                             optionally followed by a 4-byte FName.Number
 *                             trailer for certain Soulmask embeddeds
 *                             (e.g. JianZhuInstGLQComponent)
 *
 * `null` for `path` / `classPath` means the field was NOT on the wire (so
 * the writer skips it). An empty string with the corresponding `isNull`
 * flag preserves the wire distinction between FString null-form (SaveNum=0,
 * 4 B) and empty-with-terminator (SaveNum=1, 5 B).
 */

import { Property, registerProperty, warnOrThrow } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { PropertyStream } from '../property-stream.mjs';

export class ObjectRef {
  constructor({
    kind = 0x03,
    kindOnePrefix = null,
    path = null,
    pathIsNull = false,
    classPath = null,
    classPathIsNull = false,
    embedded = null,
    hasTerminatorTrailer = false,
  } = {}) {
    this.kind = kind;
    // null = "not on the wire" (any kind other than 0x01, or a kind=0x01
    // ObjectRef built programmatically without an explicit prefix).
    // Numeric = capture from the wire; replayed verbatim on write.
    this.kindOnePrefix = kindOnePrefix;
    this.path = path;
    this.pathIsNull = pathIsNull;
    this.classPath = classPath;
    this.classPathIsNull = classPathIsNull;
    this.embedded = embedded;
    // When true, the embedded property stream was followed by a 4-byte
    // FName.Number=0 trailer. The reader detects this when exactly 4
    // trailing bytes remain inside the tag's size budget; the writer
    // replays them.
    this.hasTerminatorTrailer = hasTerminatorTrailer;
  }

  get hasEmbedded() { return this.embedded instanceof PropertyStream; }

  /**
   * Top-level read: `sizeHint` is the tight per-property byte budget from
   * the tag. The reader steps through kind / kindOnePrefix / path /
   * classPath / embedded, falling out at each "exhausted budget" check.
   */
  static fromReaderTopLevel(cursor, sizeHint, ctx) {
    const start = cursor.pos();
    const kind = cursor.readUint8();
    if (cursor.pos() - start >= sizeHint) {
      return new ObjectRef({ kind });
    }
    let kindOnePrefix = null;
    if (kind === 0x01) {
      kindOnePrefix = cursor.readUint32();
      if (cursor.pos() - start >= sizeHint) {
        return new ObjectRef({ kind, kindOnePrefix });
      }
    }
    const pathFS = cursor.readFString();
    if (cursor.pos() - start > sizeHint) throw new Error('ObjectRef: path FString exceeded value budget');
    if (cursor.pos() - start >= sizeHint) {
      return new ObjectRef({ kind, kindOnePrefix, path: pathFS.value, pathIsNull: pathFS.isNull });
    }
    const classPathFS = cursor.readFString();
    if (cursor.pos() - start > sizeHint) throw new Error('ObjectRef: classPath FString exceeded value budget');
    if (cursor.pos() - start >= sizeHint) {
      return new ObjectRef({ kind, kindOnePrefix,
                             path: pathFS.value, pathIsNull: pathFS.isNull,
                             classPath: classPathFS.value, classPathIsNull: classPathFS.isNull });
    }
    const stream = PropertyStream.fromReader(cursor, start + sizeHint, { ctx });
    let hasTerminatorTrailer = false;
    if (stream.terminated && cursor.pos() + 4 === start + sizeHint && cursor.remaining() >= 4) {
      cursor.skip(4);
      hasTerminatorTrailer = true;
    }
    // Top-level ObjectRef: the embedded stream's None terminator is part
    // of the on-wire shape (always followed by either an aligned end-of-
    // budget OR a 4-byte FName.Number trailer). A non-terminated stream
    // means we ran off the tag's size budget without seeing None — bytes
    // are malformed or the size hint is wrong. Outer Property reader will
    // throw on size mismatch anyway; this localizes the cause.
    if (!stream.terminated) {
      warnOrThrow(ctx,
        `ObjectRef[topLevel] at offset ${start}: embedded stream did not terminate ` +
        `within size budget ${sizeHint} (cursor at ${cursor.pos() - start}/${sizeHint}). ` +
        `Likely a malformed embedded stream or wrong tag size.`);
    }
    return new ObjectRef({ kind, kindOnePrefix,
      path: pathFS.value, pathIsNull: pathFS.isNull,
      classPath: classPathFS.value, classPathIsNull: classPathFS.isNull,
      embedded: stream, hasTerminatorTrailer });
  }

  /**
   * Array-element read. `sizeHint` here is the REMAINING array budget,
   * not a per-element bound, because ArrayProperty<Object> has no per-
   * element delimiter on the wire. The four guards decide where this
   * element actually ends.
   *
   * Heuristics preamble: ObjectProperty array elements have one of four
   * wire shapes, all back-to-back with no separator:
   *
   *   (A) kind-only         1 byte
   *   (B) kind+path         1 byte + FString
   *   (C) kind+path+class   1 byte + FString + FString
   *   (D) kind+path+class+embedded property stream  (terminated by None)
   *
   * Each guard catches a different way the loose budget could mislead the
   * reader into consuming the next element's bytes:
   *
   *   Guard 1: no room for even a null-form classPath FString (4 bytes).
   *   Guard 2: peek classPath saveNum is implausibly large (|n| > 1024).
   *   Guard 3: classPath's first content byte isn't '/' (Soulmask asset
   *            paths are always "/Script/..." or "/Game/...").
   *   Guard 4: bytes following classPath don't look like a PropertyTag
   *            start (small ANSI saveNum + identifier-start byte).
   */
  static fromReaderArrayElement(cursor, sizeHint, ctx) {
    const start = cursor.pos();
    const kind = cursor.readUint8();
    if (cursor.pos() - start >= sizeHint) {
      return new ObjectRef({ kind });
    }
    // kind=0 is a null/None ref: the wire payload is just the kind byte.
    // Without this early-out, the FString reader would interpret the next
    // 4 bytes (the next element's kind/etc) as a path saveNum, typically
    // a huge garbage value that overshoots the array.
    if (kind === 0) {
      return new ObjectRef({ kind });
    }
    let kindOnePrefix = null;
    if (kind === 0x01) {
      kindOnePrefix = cursor.readUint32();
      if (cursor.pos() - start >= sizeHint) {
        return new ObjectRef({ kind, kindOnePrefix });
      }
    }
    const pathFS = cursor.readFString();
    if (cursor.pos() - start > sizeHint) throw new Error('ObjectRef[array]: path FString exceeded element budget');

    // Guard 1: no room for a null-form classPath FString (4 bytes).
    const consumed1 = cursor.pos() - start;
    if (consumed1 >= sizeHint || sizeHint - consumed1 < 4) {
      return new ObjectRef({ kind, kindOnePrefix, path: pathFS.value, pathIsNull: pathFS.isNull });
    }

    // Guard 2: candidate classPath saveNum out of plausible range.
    const peekSN = cursor.peekInt32();
    if (peekSN > 1024 || peekSN < -1024) {
      return new ObjectRef({ kind, kindOnePrefix, path: pathFS.value, pathIsNull: pathFS.isNull });
    }

    // Guard 3: Soulmask classPaths always start with '/'. The bytes after
    // path might actually be the start of the NEXT element instead. Allow
    // empty/null forms (saveNum ∈ {-1, 0, 1}) as edge cases.
    if (peekSN !== 0 && peekSN !== 1 && peekSN !== -1) {
      const firstCharOff = cursor.pos() + 4;
      if (peekSN > 0) {
        // ANSI classPath: first content byte should be '/'
        if (firstCharOff >= cursor.bytes.length || cursor.bytes[firstCharOff] !== 0x2F) {
          return new ObjectRef({ kind, kindOnePrefix, path: pathFS.value, pathIsNull: pathFS.isNull });
        }
      } else {
        // UTF-16 classPath: first content code unit should be '/\0' (2F 00 LE)
        if (firstCharOff + 1 >= cursor.bytes.length ||
            cursor.bytes[firstCharOff] !== 0x2F ||
            cursor.bytes[firstCharOff + 1] !== 0x00) {
          return new ObjectRef({ kind, kindOnePrefix, path: pathFS.value, pathIsNull: pathFS.isNull });
        }
      }
    }

    const classPathFS = cursor.readFString();
    if (cursor.pos() - start > sizeHint) throw new Error('ObjectRef[array]: classPath FString exceeded element budget');
    if (cursor.pos() - start >= sizeHint) {
      return new ObjectRef({
        kind, kindOnePrefix,
        path: pathFS.value, pathIsNull: pathFS.isNull,
        classPath: classPathFS.value, classPathIsNull: classPathFS.isNull,
      });
    }

    // Guard 4: embedded stream presence. An embedded begins with a
    // PropertyTag, whose first bytes are the property name FString. Property
    // names are short identifiers (≤256 chars) starting with a letter or
    // underscore; peek to confirm before committing to a stream read.
    if (sizeHint - (cursor.pos() - start) >= 4) {
      const peekNameSN = cursor.peekInt32();
      if (peekNameSN <= 0 || peekNameSN > 256) {
        return new ObjectRef({
          kind, kindOnePrefix,
          path: pathFS.value, pathIsNull: pathFS.isNull,
          classPath: classPathFS.value, classPathIsNull: classPathFS.isNull,
        });
      }
      const firstNameByte = cursor.bytes[cursor.pos() + 4];
      const isIdentStart = firstNameByte != null && (
        (firstNameByte >= 0x41 && firstNameByte <= 0x5A) ||  // A-Z
        (firstNameByte >= 0x61 && firstNameByte <= 0x7A) ||  // a-z
        firstNameByte === 0x5F                                // _
      );
      if (!isIdentStart) {
        return new ObjectRef({
          kind, kindOnePrefix,
          path: pathFS.value, pathIsNull: pathFS.isNull,
          classPath: classPathFS.value, classPathIsNull: classPathFS.isNull,
        });
      }
    }

    const stream = PropertyStream.fromReader(cursor, start + sizeHint, { ctx });
    // Trailer detection: some Soulmask embedded streams (notably the inner
    // ObjectProperty streams in JianZhuInstYuanXings) carry the outermost-
    // stream 4-byte FName.Number=0 trailer. In the array-element context the
    // budget is loose, so we detect via content: a trailer reads as
    // 0x00000000, distinct from the next element's kind byte (0x01/0x03,
    // non-zero) or the trailing binary section's origin (12 zero bytes).
    let hasTerminatorTrailer = false;
    if (stream.terminated && cursor.pos() + 4 <= start + sizeHint && cursor.remaining() >= 4) {
      const peekTrailer = cursor.peekInt32();
      if (peekTrailer === 0) {
        cursor.skip(4);
        hasTerminatorTrailer = true;
      }
    }
    // Guard 4 should have ruled out non-tagged bytes before we got here.
    // If the stream nevertheless ran off the loose budget without seeing
    // None, one of the four guards misfired or the array's value budget
    // is wrong. Flag the element so the array's cumulative size mismatch
    // points at the right element.
    if (!stream.terminated) {
      warnOrThrow(ctx,
        `ObjectRef[arrayElement] at offset ${start}: embedded stream did not terminate ` +
        `within element budget ${sizeHint} (cursor at ${cursor.pos() - start}/${sizeHint}). ` +
        `One of the four heuristic guards likely misclassified the bytes.`);
    }
    return new ObjectRef({
      kind, kindOnePrefix,
      path: pathFS.value, pathIsNull: pathFS.isNull,
      classPath: classPathFS.value, classPathIsNull: classPathFS.isNull,
      embedded: stream, hasTerminatorTrailer,
    });
  }

  toBytes(writer, { requireClassPath = false, ctx = {} } = {}) {
    writer.writeUint8(this.kind ?? 0x03);
    if (this.kindOnePrefix !== null && this.kindOnePrefix !== undefined) {
      writer.writeUint32(this.kindOnePrefix);
    }
    // Kind-only on the wire: path was null AND nothing forces emission.
    if (this.path === null && !requireClassPath && !this.hasEmbedded) return;
    writer.writeFString(this.path ?? '', null, this.pathIsNull);
    if (requireClassPath || this.classPath !== null || this.hasEmbedded) {
      writer.writeFString(this.classPath ?? '', null, this.classPathIsNull);
    }
    if (this.hasEmbedded) {
      this.embedded.toBytes(writer, { emitTerminatorTrailer: this.hasTerminatorTrailer, ctx });
    }
  }

  toJSON() {
    const j = { kind: this.kind };
    if (this.kindOnePrefix != null) j.kindOnePrefix = this.kindOnePrefix;
    if (this.path !== null) j.path = this.path;
    if (this.pathIsNull) j.pathIsNull = true;
    if (this.classPath !== null) j.classPath = this.classPath;
    if (this.classPathIsNull) j.classPathIsNull = true;
    if (this.hasEmbedded) j.embedded = this.embedded.toJSON();
    if (this.hasTerminatorTrailer) j.hasTerminatorTrailer = true;
    return j;
  }

  static fromJSON(j) {
    return new ObjectRef({
      kind: j.kind,
      kindOnePrefix: 'kindOnePrefix' in j ? j.kindOnePrefix : null,
      path: 'path' in j ? j.path : null,
      pathIsNull: !!j.pathIsNull,
      classPath: 'classPath' in j ? j.classPath : null,
      classPathIsNull: !!j.classPathIsNull,
      embedded: j.embedded ? PropertyStream.fromJSON(j.embedded) : null,
      hasTerminatorTrailer: !!j.hasTerminatorTrailer,
    });
  }
}

export class ObjectProperty extends Property {
  constructor({ tag, value = null } = {}) {
    super({ tag });
    this.value = value;   // ObjectRef
  }

  static fromReader(cursor, tag, sizeHint, ctx) {
    return new this({ tag, value: ObjectRef.fromReaderTopLevel(cursor, sizeHint, ctx) });
  }

  _writeValue(w, ctx) { this.value.toBytes(w, { ctx }); }

  _writeJSON(j) { j.value = this.value.toJSON(); }

  static fromJSON(j) {
    return new this({ tag: PropertyTag.fromJSON(j), value: ObjectRef.fromJSON(j.value) });
  }
}

// Aliases: same wire layout, different declared type in the tag.
export class ClassProperty       extends ObjectProperty {}
export class WeakObjectProperty  extends ObjectProperty {}
export class LazyObjectProperty  extends ObjectProperty {}
export class WSObjectProperty    extends ObjectProperty {}

registerProperty('ObjectProperty',     ObjectProperty);
registerProperty('ClassProperty',      ClassProperty);
registerProperty('WeakObjectProperty', WeakObjectProperty);
registerProperty('LazyObjectProperty', LazyObjectProperty);
registerProperty('WSObjectProperty',   WSObjectProperty);
