/**
 * JSON converter for the wscodec object tree. Part of the public codec API.
 *
 *   blobToJSON(blob)        UnrealBlob → JSON-safe plain object
 *   jsonToBlob(json)        plain object → UnrealBlob
 *   blobToJSONString(blob)  shortcut: blobToJSON + JSON.stringify (with -0/NaN/Inf handling)
 *   jsonStringToBlob(str)   shortcut: JSON.parse (with -0/NaN/Inf handling) + jsonToBlob
 *
 * Round-trip guarantee: when the input bytes decode cleanly, the chain
 *   bytes → UnrealBlob.decode → blobToJSON → JSON.stringify
 *         → JSON.parse → jsonToBlob → UnrealBlob.serialize
 * produces the same bytes as the input. Verified on every row of every tested
 * Soulmask world.db (`node test/test-json-full.mjs <path>`).
 *
 * Design rules:
 *   - Convert as much as possible to structured JSON. Base64 is reserved for
 *     genuinely undecoded content: OpaqueValue (codec gave up on this slot)
 *     and ArrayValue._perElementTrailings (JianZhuInstYuanXings placement
 *     blocks whose semantics we don't decode).
 *   - Preserve every wire-form distinction needed for byte-identical round
 *     trip: FString isNull flags, ObjectRef kindOnePrefix /
 *     hasTerminatorTrailer, StructValue propStream-vs-binary form, FText
 *     historyType variants, ArrayValue innerTag for struct arrays,
 *     MapProperty<StructProperty,_> key/value conventions, etc.
 *   - JSON shapes are tagged with discriminators where the decoder needs to
 *     dispatch: `form` on StructValue ('binary' | 'propStream' | 'decodeError'),
 *     `historyType` on FTextValue, `_opaque` on OpaqueValue payloads.
 *
 * Numeric edge cases (-0, NaN, +/-Infinity) round-trip through
 * blobToJSONString / jsonStringToBlob via a sentinel substitution; the bare
 * blobToJSON / jsonToBlob pair preserves them inside the JS object tree
 * (because Object.is(-0, -0)) but a naive JSON.stringify would lose them.
 */

import { FName, FGuid }                                       from './primitives.mjs';
import { StructValue }                                        from './structs.mjs';
import { PropertyTag, Property, ArrayValue, SetValue, MapValue } from './properties.mjs';
import { ObjectRef, SoftObjectRef, FTextValue, OpaqueValue }  from './values.mjs';
// Intentional cycle: UnrealBlob is defined in wscodec.mjs, and wscodec.mjs
// re-exports this module's symbols. ESM live bindings make this safe as long
// as UnrealBlob is only USED inside function bodies (deferred), which it is.
import { UnrealBlob } from './wscodec.mjs';

// ── base64 helpers (Node Buffer) ────────────────────────────────────────────
function b64encode(u8) { return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64'); }
function b64decode(s)  { return new Uint8Array(Buffer.from(s, 'base64')); }

// ── FName helpers ───────────────────────────────────────────────────────────
// Names round-trip as bare strings in the common case. When isUnicode or
// isNull is non-default, fall back to an object form so the wire flags survive.
function nameJSON(fn) {
  if (fn == null) return null;
  if (fn instanceof FName) {
    if (!fn.isUnicode && !fn.isNull && (fn.number | 0) === 0) return fn.value;
    return { value: fn.value, isUnicode: fn.isUnicode, isNull: fn.isNull, number: fn.number };
  }
  return String(fn);
}
function nameFromJSON(j) {
  if (j == null) return null;
  return FName.from(j);
}

// ── PropertyTag JSON ────────────────────────────────────────────────────────
function tagToJSON(tag) {
  const j = { name: nameJSON(tag.name), type: nameJSON(tag.type), size: tag.size };
  if (tag.arrayIndex) j.arrayIndex = tag.arrayIndex;
  switch (tag.type?.value) {
    case 'StructProperty': j.structName = nameJSON(tag.structName); j.structGuid = tag.structGuid?.value ?? null; break;
    case 'BoolProperty':   j.boolVal = tag.boolVal; break;
    case 'ByteProperty':
    case 'EnumProperty':   j.enumName = nameJSON(tag.enumName); break;
    case 'ArrayProperty':
    case 'SetProperty':    j.innerType = nameJSON(tag.innerType); break;
    case 'MapProperty':    j.innerType = nameJSON(tag.innerType); j.valueType = nameJSON(tag.valueType); break;
  }
  if (tag.hasPropertyGuid) {
    j.hasPropertyGuid = true;
    j.propertyGuid = tag.propertyGuid?.value ?? null;
  }
  return j;
}
function tagFromJSON(j) {
  const tag = new PropertyTag({
    name: nameFromJSON(j.name),
    type: nameFromJSON(j.type),
    size: j.size,
    arrayIndex: j.arrayIndex || 0,
    hasPropertyGuid: !!j.hasPropertyGuid,
  });
  switch (tag.type?.value) {
    case 'StructProperty': tag.structName = nameFromJSON(j.structName); tag.structGuid = j.structGuid ? new FGuid(j.structGuid) : null; break;
    case 'BoolProperty':   tag.boolVal = j.boolVal; break;
    case 'ByteProperty':
    case 'EnumProperty':   tag.enumName = nameFromJSON(j.enumName); break;
    case 'ArrayProperty':
    case 'SetProperty':    tag.innerType = nameFromJSON(j.innerType); break;
    case 'MapProperty':    tag.innerType = nameFromJSON(j.innerType); tag.valueType = nameFromJSON(j.valueType); break;
  }
  if (tag.hasPropertyGuid) tag.propertyGuid = j.propertyGuid ? new FGuid(j.propertyGuid) : null;
  return tag;
}

// ── Value JSON, dispatching on tag.type and tag.innerType/valueType ─────────
function valueToJSON(tag, value) {
  if (value instanceof OpaqueValue) {
    return { _opaque: true, bytes: b64encode(value.bytes), reason: value.reason };
  }
  const t = tag.type.value;
  switch (t) {
    case 'IntProperty': case 'Int8Property': case 'Int16Property':
    case 'UInt16Property': case 'UInt32Property':
    case 'FloatProperty': case 'DoubleProperty':
    case 'BoolProperty':
      return value;
    case 'Int64Property': case 'UInt64Property':
      return value;                                // already string
    case 'StrProperty':
      return value;                                // bare string
    case 'NameProperty':
    case 'EnumProperty':
      return nameJSON(value);
    case 'ByteProperty':
      // enumName==='None' → numeric byte, else FName.
      return tag.enumName?.value === 'None' ? value : nameJSON(value);
    case 'ObjectProperty': case 'ClassProperty':
    case 'WeakObjectProperty': case 'LazyObjectProperty':
    case 'WSObjectProperty':
      return objectRefToJSON(value);
    case 'SoftObjectProperty': case 'SoftClassProperty':
      return { assetPath: value.assetPath, subPath: value.subPath };
    case 'StructProperty':
      return structValueToJSON(value);
    case 'ArrayProperty':
      return arrayValueToJSON(value, tag);
    case 'SetProperty':
      return setValueToJSON(value, tag);
    case 'MapProperty':
      return mapValueToJSON(value, tag);
    case 'TextProperty':
      return fTextToJSON(value);
    default:
      throw new Error(`valueToJSON: unsupported type ${t}`);
  }
}

function valueFromJSON(tag, j) {
  if (j && typeof j === 'object' && !Array.isArray(j) && j._opaque) {
    return new OpaqueValue(b64decode(j.bytes), j.reason ?? null);
  }
  const t = tag.type.value;
  switch (t) {
    case 'IntProperty': case 'Int8Property': case 'Int16Property':
    case 'UInt16Property': case 'UInt32Property':
    case 'FloatProperty': case 'DoubleProperty':
    case 'BoolProperty':
      return j;
    case 'Int64Property': case 'UInt64Property':
      return String(j);
    case 'StrProperty':
      return j;
    case 'NameProperty':
    case 'EnumProperty':
      return nameFromJSON(j);
    case 'ByteProperty':
      return tag.enumName?.value === 'None' ? j : nameFromJSON(j);
    case 'ObjectProperty': case 'ClassProperty':
    case 'WeakObjectProperty': case 'LazyObjectProperty':
    case 'WSObjectProperty':
      return objectRefFromJSON(j);
    case 'SoftObjectProperty': case 'SoftClassProperty':
      return new SoftObjectRef({ assetPath: j.assetPath, subPath: j.subPath });
    case 'StructProperty':
      return structValueFromJSON(j, tag.structName?.value);
    case 'ArrayProperty':
      return arrayValueFromJSON(j, tag);
    case 'SetProperty':
      return setValueFromJSON(j, tag);
    case 'MapProperty':
      return mapValueFromJSON(j, tag);
    case 'TextProperty':
      return fTextFromJSON(j);
    default:
      throw new Error(`valueFromJSON: unsupported type ${t}`);
  }
}

// ── ObjectRef ───────────────────────────────────────────────────────────────
function objectRefToJSON(v) {
  if (!(v instanceof ObjectRef)) throw new Error(`objectRefToJSON: expected ObjectRef, got ${v?.constructor?.name}`);
  const j = { kind: v._objectKind };
  if (v._kindOnePrefix != null) j.kindOnePrefix = v._kindOnePrefix;
  if (v.path !== null) j.path = v.path;
  if (v._pathIsNull) j.pathIsNull = true;
  if (v.classPath !== null) j.classPath = v.classPath;
  if (v._classPathIsNull) j.classPathIsNull = true;
  if (Array.isArray(v.embedded)) {
    j.embedded = v.embedded.map(propertyToJSON);
    if (v.terminated) j.embeddedTerminated = true;
    if (v.hasTerminatorTrailer) j.hasTerminatorTrailer = true;
  }
  return j;
}
function objectRefFromJSON(j) {
  return new ObjectRef({
    kind: j.kind,
    kindOnePrefix: 'kindOnePrefix' in j ? j.kindOnePrefix : null,
    path: 'path' in j ? j.path : null,
    pathIsNull: !!j.pathIsNull,
    classPath: 'classPath' in j ? j.classPath : null,
    classPathIsNull: !!j.classPathIsNull,
    embedded: Array.isArray(j.embedded) ? j.embedded.map(propertyFromJSON) : null,
    terminated: !!j.embeddedTerminated,
    hasTerminatorTrailer: !!j.hasTerminatorTrailer,
  });
}

// ── StructValue ─────────────────────────────────────────────────────────────
// Three forms, distinguished by the `form` discriminator:
//   "binary"     — STRUCT_HANDLERS produced a plain object/string for this struct
//   "propStream" — unknown struct name, decoded as a nested property stream
//   "decodeError"— struct decode failed; opaqueTail holds the leftover bytes
function structValueToJSON(v) {
  if (!(v instanceof StructValue)) throw new Error(`structValueToJSON: expected StructValue, got ${v?.constructor?.name}`);
  if (v._structDecodeError) {
    return {
      form: 'decodeError',
      error: v._structDecodeError,
      opaqueTail: v._opaqueTail ? b64encode(v._opaqueTail) : null,
    };
  }
  if (Array.isArray(v.value)) {
    return {
      form: 'propStream',
      terminated: !!v.terminated,
      properties: v.value.map(propertyToJSON),
    };
  }
  // Binary handler. Special-case value shapes that aren't plain objects:
  //   Guid → FGuid (has .value); we JSON it as a bare string
  //   DateTime/Timespan → already string
  let jval = v.value;
  if (v.value instanceof FGuid) jval = v.value.value;
  return { form: 'binary', value: jval };
}
function structValueFromJSON(j, structName) {
  if (j.form === 'decodeError') {
    return new StructValue(structName, {
      value: [], decodeError: j.error,
      opaqueTail: j.opaqueTail ? b64decode(j.opaqueTail) : null,
    });
  }
  if (j.form === 'propStream') {
    return new StructValue(structName, {
      value: j.properties.map(propertyFromJSON),
      terminated: !!j.terminated,
    });
  }
  if (j.form === 'binary') {
    let val = j.value;
    if (structName === 'Guid' && typeof val === 'string') val = new FGuid(val);
    return new StructValue(structName, { value: val });
  }
  throw new Error(`structValueFromJSON: unknown form '${j.form}'`);
}

// ── ArrayValue / SetValue / MapValue ────────────────────────────────────────
function arrayValueToJSON(v, tag) {
  if (!(v instanceof ArrayValue)) throw new Error(`arrayValueToJSON: expected ArrayValue, got ${v?.constructor?.name}`);
  const innerType = tag.innerType.value;
  const j = { elements: v.elements.map(e => arrayElementToJSON(e, innerType, v._arrayInnerTag)) };
  if (v._arrayInnerTag) j.innerTag = tagToJSON(v._arrayInnerTag);
  if (v._perElementTrailings) {
    // Per-element placement-binary block (JianZhuInstYuanXings). Each entry is
    // either null OR { transforms: [[16 floats], …], ids: [u32, …], aux: [[16 floats], …] }.
    // Header and strides are constants on the wire — synthesized on write.
    j.perElementTrailings = v._perElementTrailings.map(t => {
      if (t == null) return null;
      return { transforms: t.transforms, ids: t.ids, aux: t.aux };
    });
  }
  return j;
}
function arrayValueFromJSON(j, tag) {
  const innerType = tag.innerType.value;
  const innerTag = j.innerTag ? tagFromJSON(j.innerTag) : null;
  const elements = j.elements.map(e => arrayElementFromJSON(e, innerType, innerTag));
  let perElementTrailings = null;
  if (Array.isArray(j.perElementTrailings)) {
    perElementTrailings = j.perElementTrailings.map(t => {
      if (t == null) return null;
      return { transforms: t.transforms, ids: t.ids, aux: t.aux };
    });
  }
  return new ArrayValue({ elements, innerTag, perElementTrailings });
}

// Array/Set element converters. For StructProperty arrays the element is a
// StructValue (the struct-array path always emits one inner PropertyTag and
// uses STRUCT_HANDLERS or a property stream per element).
function arrayElementToJSON(e, innerType, innerTag) {
  if (innerType === 'StructProperty') return structValueToJSON(e);
  switch (innerType) {
    case 'IntProperty': case 'Int8Property': case 'Int16Property':
    case 'UInt16Property': case 'UInt32Property':
    case 'FloatProperty': case 'DoubleProperty':
    case 'BoolProperty': case 'ByteProperty':
      return e;
    case 'Int64Property': case 'UInt64Property':
      return e;                                  // already string
    case 'StrProperty':
      return e;
    case 'NameProperty': case 'EnumProperty':
      return nameJSON(e);
    case 'TextProperty':
      if (e instanceof OpaqueValue) return { _opaque: true, bytes: b64encode(e.bytes), reason: e.reason };
      return fTextToJSON(e);
    case 'ObjectProperty': case 'ClassProperty':
    case 'WeakObjectProperty': case 'LazyObjectProperty':
    case 'WSObjectProperty':
      return objectRefToJSON(e);
    case 'SoftObjectProperty': case 'SoftClassProperty':
      return { assetPath: e.assetPath, subPath: e.subPath };
    default:
      throw new Error(`arrayElementToJSON: unsupported innerType ${innerType}`);
  }
}
function arrayElementFromJSON(j, innerType, innerTag) {
  if (innerType === 'StructProperty') return structValueFromJSON(j, innerTag?.structName?.value);
  if (j && typeof j === 'object' && !Array.isArray(j) && j._opaque) {
    return new OpaqueValue(b64decode(j.bytes), j.reason ?? null);
  }
  switch (innerType) {
    case 'IntProperty': case 'Int8Property': case 'Int16Property':
    case 'UInt16Property': case 'UInt32Property':
    case 'FloatProperty': case 'DoubleProperty':
    case 'BoolProperty': case 'ByteProperty':
      return j;
    case 'Int64Property': case 'UInt64Property':
      return String(j);
    case 'StrProperty':
      return j;
    case 'NameProperty': case 'EnumProperty':
      return nameFromJSON(j);
    case 'TextProperty':
      return fTextFromJSON(j);
    case 'ObjectProperty': case 'ClassProperty':
    case 'WeakObjectProperty': case 'LazyObjectProperty':
    case 'WSObjectProperty':
      return objectRefFromJSON(j);
    case 'SoftObjectProperty': case 'SoftClassProperty':
      return new SoftObjectRef({ assetPath: j.assetPath, subPath: j.subPath });
    default:
      throw new Error(`arrayElementFromJSON: unsupported innerType ${innerType}`);
  }
}

function setValueToJSON(v, tag) {
  return {
    removed:  v.removed.map(e => setElementToJSON(e, tag.innerType.value)),
    elements: v.elements.map(e => setElementToJSON(e, tag.innerType.value)),
  };
}
function setValueFromJSON(j, tag) {
  return new SetValue({
    removed:  j.removed.map(e => setElementFromJSON(e, tag.innerType.value)),
    elements: j.elements.map(e => setElementFromJSON(e, tag.innerType.value)),
  });
}
// Set<StructProperty> elements are raw FGuid values (per readSetElement);
// other inner types share the array-element shape.
function setElementToJSON(e, innerType) {
  if (innerType === 'StructProperty') return e;       // Guid string
  return arrayElementToJSON(e, innerType, null);
}
function setElementFromJSON(j, innerType) {
  if (innerType === 'StructProperty') return j;       // Guid string
  return arrayElementFromJSON(j, innerType, null);
}

function mapValueToJSON(v, tag) {
  const keyType = tag.innerType.value;
  const valType = tag.valueType.value;
  return {
    removed: v.removed.map(k => mapElementToJSON(k, keyType, /*isKey=*/true)),
    entries: v.entries.map(e => ({
      key:   mapElementToJSON(e.key,   keyType, true),
      value: mapElementToJSON(e.value, valType, false),
    })),
  };
}
function mapValueFromJSON(j, tag) {
  const keyType = tag.innerType.value;
  const valType = tag.valueType.value;
  return new MapValue({
    removed: j.removed.map(k => mapElementFromJSON(k, keyType, true)),
    entries: j.entries.map(e => ({
      key:   mapElementFromJSON(e.key,   keyType, true),
      value: mapElementFromJSON(e.value, valType, false),
    })),
  });
}
// Map<StructProperty,_> keys are always 16-byte FGuids (string). Map values
// with StructProperty type are either a StructValue (propStream form) OR a
// Guid string; we distinguish on JSON shape (object with form=propStream vs
// bare string).
function mapElementToJSON(v, type, isKey) {
  if (type === 'StructProperty') {
    if (isKey) return v;                                            // Guid string
    if (v instanceof StructValue) return structValueToJSON(v);
    return v;                                                        // Guid string
  }
  return arrayElementToJSON(v, type, null);
}
function mapElementFromJSON(j, type, isKey) {
  if (type === 'StructProperty') {
    if (isKey) return j;
    if (j && typeof j === 'object' && j.form) return structValueFromJSON(j, '(map value)');
    return j;
  }
  return arrayElementFromJSON(j, type, null);
}

// ── FText ───────────────────────────────────────────────────────────────────
function fTextToJSON(v) {
  if (!(v instanceof FTextValue)) throw new Error(`fTextToJSON: expected FTextValue, got ${v?.constructor?.name}`);
  const j = { flags: v.flags, historyType: v.historyType };
  if (v.historyType === -1) {
    if (v.displayString != null) {
      j.displayString = v.displayString;
      if (v._displayStringIsNull) j.displayStringIsNull = true;
    } else {
      j.displayString = null;
    }
  } else if (v.historyType === 0) {
    j.namespace = v.namespace; if (v._namespaceIsNull) j.namespaceIsNull = true;
    j.key = v.key;             if (v._keyIsNull) j.keyIsNull = true;
    if (v.sourceString != null) {
      j.sourceString = v.sourceString;
      if (v._sourceStringIsNull) j.sourceStringIsNull = true;
    } else {
      j.sourceString = null;
    }
  } else if (v.historyType === 1) {
    j.sourceFmt = fTextToJSON(v.sourceFmt);
    j.arguments = v.arguments.map(a => fTextNamedArgToJSON(a));
  } else if (v.historyType === 2) {
    j.sourceFmt = fTextToJSON(v.sourceFmt);
    j.arguments = v.arguments.map(a => fTextArgToJSON(a));
  } else if (v.historyType === 4) {
    j.sourceValue = fTextArgToJSON(v.sourceValue);
    j.formatOptions = v.formatOptions;
    if (v.culture != null) {
      j.culture = v.culture;
      if (v._cultureIsNull) j.cultureIsNull = true;
    } else {
      j.culture = null;
    }
  } else {
    // Unknown historyType: codec stored remaining bytes verbatim in _raw.
    j._raw = v._raw ? b64encode(v._raw) : null;
  }
  return j;
}
function fTextFromJSON(j) {
  const ht = j.historyType;
  if (ht === -1) {
    return new FTextValue({
      flags: j.flags, historyType: -1,
      displayString: j.displayString ?? null,
      displayStringIsNull: !!j.displayStringIsNull,
    });
  }
  if (ht === 0) {
    return new FTextValue({
      flags: j.flags, historyType: 0,
      namespace: j.namespace ?? '',       namespaceIsNull: !!j.namespaceIsNull,
      key: j.key ?? '',                   keyIsNull: !!j.keyIsNull,
      sourceString: j.sourceString ?? null, sourceStringIsNull: !!j.sourceStringIsNull,
    });
  }
  if (ht === 1) {
    return new FTextValue({
      flags: j.flags, historyType: 1,
      sourceFmt: fTextFromJSON(j.sourceFmt),
      arguments: j.arguments.map(a => fTextNamedArgFromJSON(a)),
    });
  }
  if (ht === 2) {
    return new FTextValue({
      flags: j.flags, historyType: 2,
      sourceFmt: fTextFromJSON(j.sourceFmt),
      arguments: j.arguments.map(a => fTextArgFromJSON(a)),
    });
  }
  if (ht === 4) {
    return new FTextValue({
      flags: j.flags, historyType: 4,
      sourceValue: fTextArgFromJSON(j.sourceValue),
      formatOptions: j.formatOptions ?? null,
      culture: j.culture ?? null,
      cultureIsNull: !!j.cultureIsNull,
    });
  }
  return new FTextValue({
    flags: j.flags, historyType: ht,
    _raw: j._raw ? b64decode(j._raw) : null,
  });
}
function fTextArgToJSON(a) {
  if (a.type === 4) return { type: 4, value: fTextToJSON(a.value) };
  return { type: a.type, value: a.value };
}
function fTextArgFromJSON(a) {
  if (a.type === 4) return { type: 4, value: fTextFromJSON(a.value) };
  return { type: a.type, value: a.value };
}
// Named-format arg: same as positional but with a key FString prefix.
function fTextNamedArgToJSON(a) {
  const j = { key: a.key };
  if (a.keyIsNull) j.keyIsNull = true;
  j.type = a.type;
  j.value = a.type === 4 ? fTextToJSON(a.value) : a.value;
  return j;
}
function fTextNamedArgFromJSON(a) {
  return {
    key: a.key,
    keyIsNull: !!a.keyIsNull,
    type: a.type,
    value: a.type === 4 ? fTextFromJSON(a.value) : a.value,
  };
}

// ── Property ────────────────────────────────────────────────────────────────
function propertyToJSON(p) {
  return { tag: tagToJSON(p.tag), value: valueToJSON(p.tag, p.value) };
}
function propertyFromJSON(j) {
  const tag = tagFromJSON(j.tag);
  const value = valueFromJSON(tag, j.value);
  return new Property(tag, value);
}

// ── Top-level UnrealBlob ────────────────────────────────────────────────────
export function blobToJSON(blob) {
  const j = {
    versionTag: blob.versionTag,
    terminated: !!blob.terminated,
    properties: blob.properties.map(propertyToJSON),
  };
  if (blob.bodyTrailing && blob.bodyTrailing.length > 0) {
    j.bodyTrailing = b64encode(blob.bodyTrailing);
  }
  return j;
}
export function jsonToBlob(j) {
  const blob = new UnrealBlob({
    versionTag: j.versionTag,
    properties: j.properties.map(propertyFromJSON),
    terminated: !!j.terminated,
    bodyTrailing: j.bodyTrailing ? b64decode(j.bodyTrailing) : null,
  });
  blob._dirty = true;            // force re-encode path on serialize()
  blob._recomputeSizes = true;   // JSON is the editing path; tag.size must
                                 // be rewritten from actual value bytes.
  return blob;
}

// ── -0 / NaN / Infinity preservation ────────────────────────────────────────
// JSON drops sign on negative zero (`JSON.stringify(-0) === "0"`) and turns
// non-finite numbers into `null`. UE serializes them verbatim, so any of these
// in the data round-trips as a different bit pattern unless we intervene.
// We substitute a sentinel string at stringify time and reverse it at parse
// time, via JSON.stringify's replacer / JSON.parse's reviver hooks.
//
// The sentinel surface is space-bounded to make accidental collision with a
// real string vanishingly unlikely. If you ever see a string field containing
// these exact literals in your data, audit this list first.
const NEG_ZERO_SENTINEL = ' __wscodec_neg_zero__ ';
const POS_INF_SENTINEL  = ' __wscodec_pos_inf__ ';
const NEG_INF_SENTINEL  = ' __wscodec_neg_inf__ ';
const NAN_SENTINEL      = ' __wscodec_nan__ ';

/**
 * JSON.stringify replacer that substitutes sentinels for -0 / Infinity / NaN.
 * Pass this to any JSON.stringify call that may contain wscodec-derived numbers
 * (including a blob nested inside a larger envelope). Use jsonReviver on the
 * matching JSON.parse to invert.
 */
export function jsonReplacer(_key, value) {
  if (typeof value !== 'number') return value;
  if (Object.is(value, -0)) return NEG_ZERO_SENTINEL;
  if (value === Infinity)   return POS_INF_SENTINEL;
  if (value === -Infinity)  return NEG_INF_SENTINEL;
  if (Number.isNaN(value))  return NAN_SENTINEL;
  return value;
}
/** Inverse of jsonReplacer. Pass to JSON.parse(text, jsonReviver). */
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

/** Stringify a blob with proper handling of -0 / Infinity / NaN. Use this instead of bare JSON.stringify. */
export function blobToJSONString(blob, indent) { return JSON.stringify(blobToJSON(blob), jsonReplacer, indent); }
/** Parse + reconstruct a blob with proper handling of -0 / Infinity / NaN. Use this instead of bare JSON.parse. */
export function jsonStringToBlob(str)         { return jsonToBlob(JSON.parse(str, jsonReviver)); }
