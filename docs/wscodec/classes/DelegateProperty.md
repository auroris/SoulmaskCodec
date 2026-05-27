[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / DelegateProperty

# Class: DelegateProperty

Defined in: [properties/delegate.mjs:25](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/delegate.mjs#L25)

UE DelegateProperty. Wire bytes are captured verbatim by the
[OpaqueProperty](OpaqueProperty.md) base; this subclass exists so `tag.type` round-trips
and so the warn message names the delegate family rather than reporting
"unknown type".

## Extends

- [`OpaqueProperty`](OpaqueProperty.md)

## Extended by

- [`MulticastDelegateProperty`](MulticastDelegateProperty.md)
- [`MulticastInlineDelegateProperty`](MulticastInlineDelegateProperty.md)
- [`MulticastSparseDelegateProperty`](MulticastSparseDelegateProperty.md)

## Constructors

### Constructor

> **new DelegateProperty**(`opts?`): `DelegateProperty`

Defined in: [properties/opaque.mjs:92](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L92)

#### Parameters

##### opts?

###### tag?

[`PropertyTag`](PropertyTag.md)

###### bytes?

`Uint8Array`\<`ArrayBufferLike`\>

###### reason?

`string` = `null`

#### Returns

`DelegateProperty`

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`constructor`](OpaqueProperty.md#constructor)

## Properties

### bytes

> **bytes**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [properties/opaque.mjs:94](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L94)

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`bytes`](OpaqueProperty.md#bytes)

***

### reason

> **reason**: `string`

Defined in: [properties/opaque.mjs:95](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L95)

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`reason`](OpaqueProperty.md#reason)

***

### tag

> **tag**: [`PropertyTag`](PropertyTag.md)

Defined in: [property.mjs:100](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L100)

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`tag`](OpaqueProperty.md#tag)

## Accessors

### name

#### Get Signature

> **get** **name**(): `string`

Defined in: [property.mjs:104](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L104)

Property name (`tag.name.value`), or null for a tag-less / synthetic property.

##### Returns

`string`

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`name`](OpaqueProperty.md#name)

***

### type

#### Get Signature

> **get** **type**(): `string`

Defined in: [property.mjs:106](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L106)

Property UE type (`tag.type.value`), or null.

##### Returns

`string`

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`type`](OpaqueProperty.md#type)

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `tag`, `sizeHint`, `ctx`): `DelegateProperty`

Defined in: [properties/delegate.mjs:26](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/delegate.mjs#L26)

Called by `Property.fromReader` as the fallback when `tag.type.value`
isn't in the registry — captures the value bytes verbatim and emits
a structured warn (or throws under strict mode).

#### Parameters

##### cursor

`any`

##### tag

`any`

##### sizeHint

`any`

##### ctx

`any`

#### Returns

`DelegateProperty`

#### Overrides

[`OpaqueProperty`](OpaqueProperty.md).[`fromReader`](OpaqueProperty.md#fromreader)

***

### \_writeValue()

> **\_writeValue**(`writer`): `void`

Defined in: [properties/opaque.mjs:110](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L110)

Write the property's value bytes only — the tag has already been
emitted by `toBytes`. Subclasses must override.

#### Parameters

##### writer

`any`

#### Returns

`void`

#### Throws

on the base class (unimplemented).

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`_writeValue`](OpaqueProperty.md#_writevalue)

***

### \_writeJSON()

> **\_writeJSON**(`j`): `void`

Defined in: [properties/opaque.mjs:114](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L114)

Add this property's value fields to the JSON object already populated
with tag fields. Subclasses must override.

#### Parameters

##### j

`any`

#### Returns

`void`

#### Throws

on the base class (unimplemented).

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`_writeJSON`](OpaqueProperty.md#_writejson)

***

### fromJSON()

> `static` **fromJSON**(`j`): [`OpaqueProperty`](OpaqueProperty.md)

Defined in: [properties/opaque.mjs:119](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L119)

Reconstruct a Property from its JSON form. Dispatches on `j.type`;
unknown types fall through to the opaque fallback.

#### Parameters

##### j

`any`

#### Returns

[`OpaqueProperty`](OpaqueProperty.md)

#### Throws

when no handler and no opaque fallback are registered.

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`fromJSON`](OpaqueProperty.md#fromjson)

***

### toBytes()

> **toBytes**(`writer`, `ctx?`): `void`

Defined in: [property.mjs:154](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L154)

Encode the property to the writer in a single forward pass: emit the
tag (with a placeholder size), write the value bytes directly into
the writer, then patch the size field with the actual value byte
count. No sub-buffer allocation, no double-copy.

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

##### ctx?

`any` = `{}`

Encode context (reserved for future use).

#### Returns

`void`

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`toBytes`](OpaqueProperty.md#tobytes)

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property.mjs:179](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L179)

Flat JSON shape: tag fields + value fields merged into one object via
the subclass's `_writeJSON`. Inverse of `Property.fromJSON`.

#### Returns

`any`

#### Inherited from

[`OpaqueProperty`](OpaqueProperty.md).[`toJSON`](OpaqueProperty.md#tojson)
