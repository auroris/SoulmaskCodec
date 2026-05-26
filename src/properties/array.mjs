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

import { Writer } from '../io.mjs';
import { Property, registerProperty } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { StructValue, STRUCT_HANDLERS } from './struct.mjs';
import { readElement, writeElement, elementToJSON, elementFromJSON } from '../element-codec.mjs';

export class ArrayProperty extends Property {
  constructor({ tag, elements = [], innerTag = null, perElementTrailings = null } = {}) {
    super({ tag });
    this.elements = elements;
    // Inner PropertyTag for Array<StructProperty>; carries the element's
    // structName/structGuid. Null for non-Struct inner types. Size is
    // computed at write time as the total byte length of all encoded
    // elements (see `_writeValue`).
    this.innerTag = innerTag;
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
      const elemStart = cursor.pos();
      const handler = STRUCT_HANDLERS[structName];
      if (handler) {
        for (let i = 0; i < numElements; i++) {
          elements.push(new StructValue(structName, { form: 'binary', binaryValue: handler.read(cursor) }));
        }
      } else {
        for (let i = 0; i < numElements; i++) {
          elements.push(StructValue.fromReader(cursor, structName, innerTagSize, ctx));
        }
      }
      const elemBytes = cursor.pos() - elemStart;
      if (innerTagSize !== elemBytes) {
        throw new Error(
          `ArrayProperty<${structName}>: innerTag.size mismatch — ` +
          `tag claimed ${innerTagSize}, elements consumed ${elemBytes} ` +
          `(${numElements} elements). The wire's innerTag.size is expected ` +
          `to equal the total bytes of all encoded elements.`
        );
      }
      return new ArrayProperty({ tag, elements, innerTag });
    }

    const isObj = _isObjectInnerType(innerType);
    const perElementTrailings = [];
    let anyPerElementTrailing = false;
    for (let i = 0; i < numElements; i++) {
      const elemSizeHint = isObj ? endOff - cursor.pos() : Infinity;
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
      // Sub-buffer all elements to measure innerTag.size (total bytes,
      // see header note), then write the inner tag with that size and
      // the buffered element bytes.
      const elementsBuf = new Writer(64);
      for (const e of this.elements) e.toBytes(elementsBuf, ctx);
      this.innerTag.toBytes(writer, elementsBuf.pos());
      writer.writeBytes(elementsBuf.finalize());
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
    // PropertyTag of the inner struct elements) is separate state; size
    // is omitted from its JSON because it's recomputed at write time.
    if (this.innerTag) j.innerTag = this.innerTag.toJSON();
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
    return new ArrayProperty({ tag, elements, innerTag, perElementTrailings });
  }
}

registerProperty('ArrayProperty', ArrayProperty);

function _isObjectInnerType(t) {
  return t === 'ObjectProperty' || t === 'ClassProperty'
      || t === 'WeakObjectProperty' || t === 'LazyObjectProperty'
      || t === 'WSObjectProperty';
}

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
