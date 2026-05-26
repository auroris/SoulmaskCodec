/**
 * Delegate / MulticastDelegate property family.
 *
 * Wire format (per UE source) is:
 *   [int32 NumDelegates]
 *   For each: [UObject ref] [FName FunctionName]
 *
 * The UObject-ref encoding inside a delegate is archive-dependent and we
 * don't have ground-truth Soulmask data to verify it. We preserve the
 * bytes verbatim via the OpaqueProperty fallback so round-trip stays
 * byte-identical; a structured decoder can replace these when real data
 * shows up.
 *
 * Registering these under their UE type names ensures `Property.fromReader`
 * recognizes them as known-but-undecoded (warn) rather than the generic
 * unknown-type path (also warn, but with a less specific message).
 */

import { Property, registerProperty, warnOrThrow } from '../property.mjs';
import { PropertyTag } from '../tag.mjs';
import { b64encode, b64decode } from '../base64.mjs';

export class DelegateProperty extends Property {
  constructor({ tag, bytes, reason = null } = {}) {
    super({ tag });
    this.bytes = bytes;
    this.reason = reason;
  }

  static fromReader(cursor, tag, sizeHint, ctx) {
    const reason = `${tag.type.value} (recognized; structured decode not yet implemented)`;
    warnOrThrow(ctx, `${tag.type.value}['${tag.name.value}']: structured decode not implemented (${sizeHint} bytes captured)`);
    const bytes = cursor.readBytes(sizeHint).slice();
    return new this({ tag, bytes, reason });
  }

  _writeValue(writer) { writer.writeBytes(this.bytes); }

  _writeJSON(j) {
    j.bytes = b64encode(this.bytes);
    if (this.reason != null) j.reason = this.reason;
  }

  static fromJSON(j) {
    return new this({
      tag: PropertyTag.fromJSON(j),
      bytes: b64decode(j.bytes),
      reason: j.reason ?? null,
    });
  }
}

// Subclasses keep type names distinct for tag.type round-trip via the
// registry; the underlying logic is identical.
export class MulticastDelegateProperty             extends DelegateProperty {}
export class MulticastInlineDelegateProperty       extends DelegateProperty {}
export class MulticastSparseDelegateProperty       extends DelegateProperty {}

registerProperty('DelegateProperty',                  DelegateProperty);
registerProperty('MulticastDelegateProperty',         MulticastDelegateProperty);
registerProperty('MulticastInlineDelegateProperty',   MulticastInlineDelegateProperty);
registerProperty('MulticastSparseDelegateProperty',   MulticastSparseDelegateProperty);

