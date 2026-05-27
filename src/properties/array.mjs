/**
 * ArrayProperty: homogeneous array of values, sized by the outer tag.
 *
 * Wire layout: [int32 NumElements] [elements...]
 *
 *   Array<StructProperty> additionally carries a single inner PropertyTag
 *   (one shared by all elements) immediately after the count. Each
 *   element is then either a binary record (via STRUCT_HANDLERS) or a
 *   nested PropertyStream terminated by None. The inner tag's size on
 *   the wire is the TOTAL byte length of all encoded elements (verified:
 *   Array<Guid>{6} has innerTag.size=96=6×16).
 *
 *   Array<ObjectProperty> elements have variable shapes and no per-element
 *   delimiter; see object.mjs for the four-guard decode. Some Soulmask
 *   ObjectProperty arrays (JianZhuInstYuanXings: building-zone yuan-xings)
 *   ALSO interleave a placement-binary block after each kind=3 element —
 *   handled by `tryReadObjectArrayPerElementBlock` below.
 *
 *   Other inner types (numeric / Str / Name / Enum / Byte / Text / Soft*):
 *   element is the bare value, no per-element wrapper. Reading / writing
 *   / JSON for these delegates to element-codec.mjs.
 *
 * The placement-binary block per kind=3 yuan-xing:
 *
 *   [8 bytes zero header]
 *   [u32 stride=64] [u32 count]  [count × 16 float32]   transforms (4×4)
 *   [u32 stride= 4] [u32 count]  [count × u32]          ids
 *   [u32 stride=64] [u32 count]  [count × 16 float32]   aux (bbox + scale)
 *
 * Verified in-game 2026-05-18: numElements counts UNIQUE prototypes
 * (foundation, wall, door frame, …); transforms.length is the placed-piece
 * count per prototype; aux.length is typically equal or one greater.
 *
 * NaN bit patterns inside the float32 sections are common in Soulmask aux
 * data (observed 0xFFFFFFFF as an "invalid" sentinel) and would collapse
 * to canonical 0x7FC00000 if round-tripped via a JS Number. We capture
 * non-canonical NaNs as `{ $nanBits: u32 }` wrappers.
 */

import { Property, registerProperty } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { StructValue, STRUCT_HANDLERS } from './struct.mjs';
import { readElement, writeElement, elementToJSON, elementFromJSON, OBJECT_INNER_TYPES } from '../element-codec.mjs';

/**
 * UE ArrayProperty: a homogeneous array of values whose inner type is
 * declared in `tag.innerType`. `elements` is a plain JS array of decoded
 * values (numbers, strings, FNames, {@link ObjectRef}, {@link StructValue},
 * etc., depending on `innerType`).
 */
export class ArrayProperty extends Property {
  /**
   * @param {object} [opts]
   * @param {import('../tag.mjs').PropertyTag} [opts.tag]
   * @param {any[]}        [opts.elements]
   * @param {import('../tag.mjs').PropertyTag|null} [opts.innerTag]            Inner element tag for `Array<StructProperty>`.
   * @param {number|null}  [opts.innerTagSize]                                 Wire `innerTag.size` (captured for byte-identical round-trip).
   * @param {Array<{transforms: any[], ids: any[], aux: any[]}|null>|null} [opts.perElementTrailings] Placement-binary blocks for the JianZhuInstYuanXings array shape; null in the normal case.
   */
  constructor({ tag, elements = [], innerTag = null, innerTagSize = null, perElementTrailings = null } = {}) {
    super({ tag });
    this.elements = elements;
    // Inner PropertyTag for Array<StructProperty>; carries the element's
    // structName/structGuid. Null for non-Struct inner types.
    this.innerTag = innerTag;
    // Original wire value of innerTag.size, captured on read and replayed
    // verbatim on write to preserve byte-identical round-trip. Soulmask's
    // convention varies by game version: some saves write the byte count
    // of element[0] here (`Array<AttrDian>{5}` with element[0]=121 bytes →
    // innerTag.size=121), others write the total element bytes (the README's
    // verified `Array<Guid>{6}` → innerTag.size=96=6×16, which happens to
    // also equal element[0] size for fixed-size structs). Elements are
    // None-delimited so the count alone determines structure; this field
    // exists only to round-trip the wire's bookkeeping byte-for-byte.
    // Null = "not captured" (programmatic blob or pre-existing JSON);
    // the writer falls back to writing element[0]'s size in that case.
    this.innerTagSize = innerTagSize;
    // Parallel array of per-element trailing blocks for
    // Array<ObjectProperty> in JianZhuInstYuanXings. Entries may be null
    // when an element has no trailing of its own. Null for any other
    // ArrayProperty.
    this.perElementTrailings = perElementTrailings;
  }

  static fromReader(cursor, tag, sizeHint, ctx) {
    const startOff = cursor.pos();
    const endOff = startOff + sizeHint;
    const numElements = cursor.readInt32();
    const innerType = tag.innerType.value;
    const elements = [];

    if (innerType === 'StructProperty') {
      const innerTag = PropertyTag.fromReader(cursor);
      if (innerTag.isTerminator || innerTag.type.value !== 'StructProperty') {
        throw new Error(`ArrayProperty: expected StructProperty inner tag, got ${innerTag.type?.value}`);
      }
      const structName = innerTag.structName.value;
      const innerTagSize = innerTag._readSize;
      const handler = STRUCT_HANDLERS[structName];
      if (handler) {
        for (let i = 0; i < numElements; i++) {
          elements.push(new StructValue(structName, { form: 'binary', binaryValue: handler.read(cursor) }));
        }
      } else {
        // Each element is its own None-terminated property stream; the
        // budget is the remaining array bytes (a loose upper bound).
        // Elements with internal None terminators stop cleanly regardless
        // of which Soulmask size convention the wire used. When an
        // element's decode throws mid-stream, the StructValue catch
        // captures all remaining bytes as opaqueTail — which is correct
        // for byte-identical round-trip, but means we lose subsequent
        // elements from this array. Implementing the underlying decoder
        // gap (FText historyType, etc.) is the real fix.
        const remaining = () => endOff - cursor.pos();
        for (let i = 0; i < numElements; i++) {
          elements.push(StructValue.fromReader(cursor, structName, remaining(), ctx));
        }
      }
      return new ArrayProperty({ tag, elements, innerTag, innerTagSize });
    }

    const isObj = OBJECT_INNER_TYPES.has(innerType);
    const perElementTrailings = [];
    let anyPerElementTrailing = false;
    for (let i = 0; i < numElements; i++) {
      // Reserve at least 1 byte (= a kind-only ObjectRef) for each remaining
      // element so the current element's loose budget can't bleed into them.
      // Without this, a kind=0x09 element at the end of an array followed by
      // kind=0x00 padding elements misreads those zero bytes as a null-form
      // classPath FString + embedded stream, blowing past the buffer.
      const elemSizeHint = isObj ? (endOff - cursor.pos()) - (numElements - i - 1) : Infinity;
      elements.push(readElement(cursor, innerType, elemSizeHint, ctx));
      if (isObj) {
        const t = _tryReadObjectArrayPerElementBlock(cursor, endOff);
        if (t) anyPerElementTrailing = true;
        perElementTrailings.push(t);   // null when no trailing for this element
      }
    }

    return new ArrayProperty({
      tag, elements,
      perElementTrailings: anyPerElementTrailing ? perElementTrailings : null,
    });
  }

  _writeValue(writer, ctx) {
    const innerType = this.tag.innerType.value;
    writer.writeInt32(this.elements.length);

    if (innerType === 'StructProperty') {
      // Emit the inner tag with a placeholder size, then write each
      // element directly into the writer, then patch the inner tag's
      // size: prefer the wire's original value (captured on read into
      // `innerTagSize`) so unmodified blobs round-trip byte-identical
      // across either Soulmask convention; fall back to element[0]'s
      // size (the modern convention) when no original value is on hand.
      const sizePos = this.innerTag.toBytes(writer);
      const elemStart = writer.pos();
      let elem0End = elemStart;
      for (let i = 0; i < this.elements.length; i++) {
        this.elements[i].toBytes(writer, ctx);
        if (i === 0) elem0End = writer.pos();
      }
      const sizeToWrite = this.innerTagSize != null ? this.innerTagSize : (elem0End - elemStart);
      writer.backpatchInt32(sizePos, sizeToWrite);
      return;
    }

    const perEl = this.perElementTrailings;
    for (let i = 0; i < this.elements.length; i++) {
      writeElement(writer, innerType, this.elements[i], ctx);
      if (perEl && perEl[i]) _writeObjectArrayPerElementBlock(writer, perEl[i]);
    }
  }

  _writeJSON(j) {
    const innerType = this.tag.innerType.value;
    // innerType is already on `j` from tag.toJSON. innerTag (the FULL
    // PropertyTag of the inner struct elements) is separate state.
    if (this.innerTag) j.innerTag = this.innerTag.toJSON();
    // Preserve the wire's innerTag.size so the round-trip can replay
    // whichever convention Soulmask used (per-version: element[0] size
    // vs total). See constructor comment for details.
    if (this.innerTagSize != null) j.innerTagSize = this.innerTagSize;
    j.elements = innerType === 'StructProperty'
      ? this.elements.map(e => e.toJSON())
      : this.elements.map(e => elementToJSON(e, innerType));
    if (this.perElementTrailings) {
      j.perElementTrailings = this.perElementTrailings.map(t => {
        if (t == null) return null;
        return { transforms: t.transforms, ids: t.ids, aux: t.aux };
      });
    }
  }

  static fromJSON(j) {
    const tag = PropertyTag.fromJSON(j);
    const innerType = tag.innerType.value;
    const innerTag = j.innerTag ? PropertyTag.fromJSON(j.innerTag) : null;
    const innerTagSize = j.innerTagSize ?? null;
    const elements = innerType === 'StructProperty'
      ? (j.elements ?? []).map(e => StructValue.fromJSON(e))
      : (j.elements ?? []).map(e => elementFromJSON(e, innerType));
    let perElementTrailings = null;
    if (Array.isArray(j.perElementTrailings)) {
      perElementTrailings = j.perElementTrailings.map(t => {
        if (t == null) return null;
        return { transforms: t.transforms, ids: t.ids, aux: t.aux };
      });
    }
    return new ArrayProperty({ tag, elements, innerTag, innerTagSize, perElementTrailings });
  }
}

registerProperty('ArrayProperty', ArrayProperty);

// ── Per-element placement-binary block (JianZhuInstYuanXings) ───────────────
function _tryReadObjectArrayPerElementBlock(cursor, endOff) {
  const start = cursor.pos();
  // Minimum 8B header + 3 × 8B section header = 32B (zero-count allowed).
  if (endOff - start < 32) return null;
  for (let i = 0; i < 8; i++) {
    if (cursor.bytes[start + i] !== 0) return null;
  }
  // Section 0's stride must be 64. Used as the disambiguating signature.
  if (cursor.dv.getUint32(start + 8, true) !== 64) return null;

  try {
    cursor.skip(8);   // zero header
    const sections = [];
    const expected = [64, 4, 64];
    for (let i = 0; i < 3; i++) {
      if (endOff - cursor.pos() < 8) throw new Error(`section ${i} header overruns budget`);
      const stride = cursor.readUint32();
      const count  = cursor.readUint32();
      if (stride !== expected[i]) throw new Error(`section ${i} stride ${stride} != ${expected[i]}`);
      if (count > 1_000_000) throw new Error(`implausible count ${count}`);
      const dataBytes = stride * count;
      if (cursor.pos() + dataBytes > endOff) throw new Error(`section ${i} data overruns budget`);
      if (i === 1) {
        const ids = new Array(count);
        for (let k = 0; k < count; k++) ids[k] = cursor.readUint32();
        sections.push(ids);
      } else {
        const arr = new Array(count);
        for (let k = 0; k < count; k++) {
          const m = new Array(16);
          for (let j = 0; j < 16; j++) m[j] = _readFloat32PreservingNan(cursor);
          arr[k] = m;
        }
        sections.push(arr);
      }
    }
    return { transforms: sections[0], ids: sections[1], aux: sections[2] };
  } catch {
    cursor.seek(start);
    return null;
  }
}

function _writeObjectArrayPerElementBlock(writer, block) {
  writer.writeUint32(0); writer.writeUint32(0);                       // 8-byte zero header
  writer.writeUint32(64); writer.writeUint32(block.transforms.length);
  for (const m of block.transforms) for (const f of m) _writeFloat32PreservingNan(writer, f);
  writer.writeUint32(4);  writer.writeUint32(block.ids.length);
  for (const id of block.ids) writer.writeUint32(id);
  writer.writeUint32(64); writer.writeUint32(block.aux.length);
  for (const m of block.aux) for (const f of m) _writeFloat32PreservingNan(writer, f);
}

// JS's Number type collapses all NaN bit patterns into the canonical
// 0x7FC00000 on any DataView.setFloat32 call, so a wire NaN like
// 0xFFFFFFFF (observed in Soulmask JianZhuInstYuanXings aux data) wouldn't
// round-trip if we used readFloat32/writeFloat32 directly. Non-canonical
// NaNs are carried as `{ $nanBits: u32 }` wrappers.
function _readFloat32PreservingNan(cursor) {
  const bits = cursor.dv.getUint32(cursor.offset, true);
  if ((bits & 0x7F800000) === 0x7F800000 && (bits & 0x007FFFFF) !== 0 && bits !== 0x7FC00000) {
    cursor.offset += 4;
    return { $nanBits: bits >>> 0 };
  }
  return cursor.readFloat32();
}

function _writeFloat32PreservingNan(writer, f) {
  if (f !== null && typeof f === 'object' && '$nanBits' in f) {
    writer.writeUint32(f.$nanBits >>> 0);
  } else {
    writer.writeFloat32(f);
  }
}
