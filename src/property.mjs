/**
 * Property base class + type-name → subclass registry.
 *
 * The base implements:
 *   - `Property.fromReader(cursor, ctx)`: read a PropertyTag, look up the
 *     subclass for the tag's type, dispatch. Throws on size mismatch
 *     (codec bug: the value reader's consumed bytes != tag's claimed size).
 *   - `property.toBytes(writer, ctx)`: encode the value into a sub-buffer
 *     so the actual byte count is known, then emit tag(size) + value.
 *
 * Subclasses implement:
 *   - `static fromReader(cursor, tag, sizeHint, ctx)` → instance
 *   - `instance _writeValue(writer, ctx)` (writes only the value bytes)
 *   - `instance toJSON()` / `static fromJSON(j)`
 *
 * The registry is populated by the individual property files at module
 * load. `blob.mjs` imports them all, so any caller that imports `UnrealBlob`
 * transitively triggers registration.
 */

import { PropertyTag } from './tag.mjs';

/**
 * Decode context threaded through `fromReader` calls. Property subclasses
 * also stash ambient decoder state on it (e.g. ArrayProperty struct-element
 * recovery flags), so don't repurpose keys without checking call sites.
 *
 * @typedef {object} DecodeCtx
 * @property {boolean} [strict]  Escalate every warn-and-capture fallback into a thrown Error.
 */

/**
 * Type-name → property-subclass lookup. Populated at module-load time by
 * each property file's `registerProperty` call.
 *
 * @type {Record<string, typeof Property>}
 */
export const PROPERTY_REGISTRY = {};

const OPAQUE_KEY = Symbol.for('wscodec.opaque-fallback');

/**
 * Register a Property subclass under its UE type name (e.g. `'IntProperty'`,
 * `'StructProperty'`). Called by each property file at module load.
 *
 * @param {string}         typeName  UE wire-format type name.
 * @param {typeof Property} cls
 */
export function registerProperty(typeName, cls) {
  PROPERTY_REGISTRY[typeName] = cls;
}

/**
 * Register the opaque fallback class invoked for any property type with no
 * registered handler. Called once by `properties/opaque.mjs`.
 *
 * @param {typeof Property} cls
 */
export function registerOpaqueFallback(cls) {
  PROPERTY_REGISTRY[OPAQUE_KEY] = cls;
}

/**
 * @returns {typeof Property | undefined} The opaque fallback class, if registered.
 */
export function getOpaqueFallback() {
  return PROPERTY_REGISTRY[OPAQUE_KEY];
}

/**
 * Surface a codec-degradation event (opaque fallback, unknown type, etc.).
 * Default behavior is a console.warn; `ctx.strict === true` escalates to a
 * thrown Error. Use this at every decode site that would otherwise silently
 * round-trip unparsed bytes.
 *
 * @param {object} [ctx]  Decode context (e.g. `{ strict?: boolean }`).
 * @param {string} message
 * @throws {Error} when `ctx.strict` is true.
 */
export function warnOrThrow(ctx, message) {
  const msg = `[wscodec] ${message}`;
  if (ctx?.strict) throw new Error(msg);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(msg);
  }
}

/**
 * Base class for every UE property type. The base implements the common
 * "read tag, dispatch to subclass, validate byte count" decode flow and the
 * "write tag, write value, back-patch size" encode flow; subclasses provide
 * `static fromReader`, instance `_writeValue`, and `toJSON`/`fromJSON`.
 */
export class Property {
  /**
   * @param {object} [opts]
   * @param {PropertyTag} [opts.tag]
   */
  constructor({ tag } = {}) {
    this.tag = tag;
  }

  /** Property name (`tag.name.value`), or null for a tag-less / synthetic property. */
  get name() { return this.tag?.name?.value ?? null; }
  /** Property UE type (`tag.type.value`), or null. */
  get type() { return this.tag?.type?.value ?? null; }

  /**
   * Read one property: tag + value. Throws on size mismatch (the value
   * reader consumed a different number of bytes than the tag claimed —
   * that's a codec bug).
   *
   * Returns a `TerminatorProperty` when the tag's Name was "None"; the
   * caller (typically `PropertyStream.fromReader`) treats that as the
   * stream terminator and does not append it to the result list.
   *
   * @param {import('./io.mjs').Cursor} cursor
   * @param {object} [ctx]  Decode context (e.g. `{ strict?: boolean }`).
   * @returns {Property}
   * @throws {Error} on size mismatch or missing opaque fallback.
   */
  static fromReader(cursor, ctx = {}) {
    const tag = PropertyTag.fromReader(cursor);
    if (tag.isTerminator) return new TerminatorProperty({ tag });

    const sizeHint = tag._readSize;
    let Sub = PROPERTY_REGISTRY[tag.type.value];
    if (!Sub) {
      Sub = PROPERTY_REGISTRY[OPAQUE_KEY];
      if (!Sub) throw new Error('Property.fromReader: no opaque fallback registered');
    }
    const valueStart = cursor.pos();
    const prop = Sub.fromReader(cursor, tag, sizeHint, ctx);

    const actualSize = cursor.pos() - valueStart;
    if (actualSize !== sizeHint) {
      throw new Error(
        `Property '${tag.name.value}' (${tag.type.value}): size mismatch — ` +
        `tag claimed ${sizeHint} bytes, decoder consumed ${actualSize}. Codec bug.`
      );
    }
    return prop;
  }

  /**
   * Encode the property to the writer in a single forward pass: emit the
   * tag (with a placeholder size), write the value bytes directly into
   * the writer, then patch the size field with the actual value byte
   * count. No sub-buffer allocation, no double-copy.
   *
   * @param {import('./io.mjs').Writer} writer
   * @param {object} [ctx]  Encode context (reserved for future use).
   */
  toBytes(writer, ctx = {}) {
    const sizePos = this.tag.toBytes(writer);
    const valueStart = writer.pos();
    this._writeValue(writer, ctx);
    writer.backpatchInt32(sizePos, writer.pos() - valueStart);
  }

  /**
   * Write the property's value bytes only — the tag has already been
   * emitted by `toBytes`. Subclasses must override.
   *
   * @param {import('./io.mjs').Writer} _writer
   * @param {object} [_ctx]
   * @throws {Error} on the base class (unimplemented).
   */
  _writeValue(_writer, _ctx) {
    throw new Error(`${this.constructor.name}._writeValue: not implemented`);
  }

  /**
   * Flat JSON shape: tag fields + value fields merged into one object via
   * the subclass's `_writeJSON`. Inverse of `Property.fromJSON`.
   *
   * @returns {object}
   */
  toJSON() {
    // Spread the tag's flat JSON (type, name, arrayIndex, type-specific
    // extras like structName/enumName/innerType/valueType, propertyGuid)
    // so the per-class _writeJSON only needs to add value bytes. Both
    // halves end up at the same level of the JSON object — flat shape.
    const j = this.tag.toJSON();
    this._writeJSON(j);
    return j;
  }

  /**
   * Add this property's value fields to the JSON object already populated
   * with tag fields. Subclasses must override.
   *
   * @param {object} _j
   * @throws {Error} on the base class (unimplemented).
   */
  _writeJSON(_j) {
    throw new Error(`${this.constructor.name}._writeJSON: not implemented`);
  }

  /**
   * Reconstruct a Property from its JSON form. Dispatches on `j.type`;
   * unknown types fall through to the opaque fallback.
   *
   * @param {object} j
   * @returns {Property}
   * @throws {Error} when no handler and no opaque fallback are registered.
   */
  static fromJSON(j) {
    const Sub = PROPERTY_REGISTRY[j.type] ?? PROPERTY_REGISTRY[OPAQUE_KEY];
    if (!Sub) throw new Error(`Property.fromJSON: no class registered for type '${j.type}' and no opaque fallback`);
    return Sub.fromJSON(j);
  }
}

/**
 * Internal-only: signals the end of a property stream. Returned by
 * `Property.fromReader` when the tag's name is "None"; never appended to
 * a PropertyStream's `.properties` list and never produced through JSON.
 */
export class TerminatorProperty extends Property {}
