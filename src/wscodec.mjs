/**
 * wscodec: pure-JS codec for Soulmask actor_data property streams.
 *
 * Public surface re-exports — `import { UnrealBlob, FName, FGuid, ... }
 * from 'wscodec';` works without reaching into individual submodules.
 *
 * Wire layout, top-level API, and Soulmask actor_data envelope are
 * documented in `blob.mjs`. Property class hierarchy and the recursive
 * fromReader/toBytes pattern are documented in `property.mjs`.
 */

// Top-level entry point.
export { UnrealBlob, codec, VERSION_TAG, jsonReplacer, jsonReviver } from './blob.mjs';

// Byte-level primitives.
export { Cursor, Writer } from './io.mjs';
export { FName, FGuid }   from './primitives.mjs';

// Property tree machinery.
export { PropertyTag }                                from './tag.mjs';
export { PropertyStream, peekLooksLikePropertyTag }   from './property-stream.mjs';
export { Property, registerProperty, warnOrThrow }    from './property.mjs';

// Property subclasses + value classes. Grouped by file.
export {
  IntProperty, Int8Property, Int16Property, Int64Property,
  UInt16Property, UInt32Property, UInt64Property,
  FloatProperty, DoubleProperty,
  BoolProperty, StrProperty, NameProperty,
  ByteProperty, EnumProperty,
} from './properties/leaf.mjs';

export { ObjectProperty, ObjectRef, ClassProperty,
         WeakObjectProperty, LazyObjectProperty, WSObjectProperty }
  from './properties/object.mjs';

export { SoftObjectProperty, SoftClassProperty, SoftObjectRef }
  from './properties/soft-object.mjs';

export { StructProperty, StructValue, STRUCT_HANDLERS, registerStructHandler }
  from './properties/struct.mjs';

export { ArrayProperty } from './properties/array.mjs';
export { SetProperty }   from './properties/set.mjs';
export { MapProperty }   from './properties/map.mjs';

export { TextProperty, FTextValue }    from './properties/text.mjs';
export { OpaqueProperty, OpaqueValue } from './properties/opaque.mjs';

export {
  DelegateProperty, MulticastDelegateProperty,
  MulticastInlineDelegateProperty, MulticastSparseDelegateProperty,
} from './properties/delegate.mjs';
