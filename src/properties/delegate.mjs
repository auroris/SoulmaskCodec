/**
 * Delegate / MulticastDelegate property family.
 *
 * Wire format (per UE source):
 *
 *   [int32 NumDelegates]
 *   For each: [UObject ref] [FName FunctionName]
 *
 * The UObject-ref encoding inside a delegate is archive-dependent and we
 * don't have ground-truth Soulmask data to verify it. We preserve the
 * bytes verbatim, sharing `OpaqueProperty`'s byte-carrying machinery.
 * Subclasses keep type names distinct for `tag.type` round-trip through
 * the registry; only `fromReader` differs (a more specific warn message
 * than `OpaqueProperty`'s "unknown type" path).
 *
 * @module wscodec/properties/delegate
 */

import { registerProperty, warnOrThrow } from '../property.mjs';
import { OpaqueProperty } from './opaque.mjs';

/**
 * Base class for delegate-family properties. Captures the value bytes
 * verbatim (no structured decode) and surfaces a warn/throw via
 * `warnOrThrow`.
 */
export class DelegateProperty extends OpaqueProperty {
  /**
   * @param {Cursor} cursor
   * @param {PropertyTag} tag
   * @param {number} sizeHint
   * @param {Object} [ctx]
   * @returns {DelegateProperty}
   */
  static fromReader(cursor, tag, sizeHint, ctx) {
    const reason = `${tag.type.value} (recognized; structured decode not yet implemented)`;
    warnOrThrow(ctx, `${tag.type.value}['${tag.name.value}']: structured decode not implemented (${sizeHint} bytes captured)`);
    const bytes = cursor.readBytes(sizeHint).slice();
    return new this({ tag, bytes, reason });
  }
}

/** Multicast delegate. Same byte-preserving behavior as `DelegateProperty`. */
export class MulticastDelegateProperty             extends DelegateProperty {}
/** Inline multicast delegate. Same byte-preserving behavior as `DelegateProperty`. */
export class MulticastInlineDelegateProperty       extends DelegateProperty {}
/** Sparse multicast delegate. Same byte-preserving behavior as `DelegateProperty`. */
export class MulticastSparseDelegateProperty       extends DelegateProperty {}

registerProperty('DelegateProperty',                  DelegateProperty);
registerProperty('MulticastDelegateProperty',         MulticastDelegateProperty);
registerProperty('MulticastInlineDelegateProperty',   MulticastInlineDelegateProperty);
registerProperty('MulticastSparseDelegateProperty',   MulticastSparseDelegateProperty);
