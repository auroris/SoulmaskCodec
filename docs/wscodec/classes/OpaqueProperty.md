[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / OpaqueProperty

# Class: OpaqueProperty

Defined in: [properties/opaque.mjs:85](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L85)

Property-level opaque carrier: the entire property is captured verbatim
when `tag.type.value` is unrecognized or a top-level value decode failed.
Registered as the opaque fallback via `registerOpaqueFallback`.

## Extends

- [`Property`](Property.md)

## Extended by

- [`DelegateProperty`](DelegateProperty.md)

## Constructors

### Constructor

> **new OpaqueProperty**(`opts?`): `OpaqueProperty`

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

`OpaqueProperty`

#### Overrides

[`Property`](Property.md).[`constructor`](Property.md#constructor)

## Properties

### bytes

> **bytes**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [properties/opaque.mjs:94](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L94)

***

### reason

> **reason**: `string`

Defined in: [properties/opaque.mjs:95](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L95)

***

### tag

> **tag**: [`PropertyTag`](PropertyTag.md)

Defined in: [property.mjs:100](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L100)

#### Inherited from

[`Property`](Property.md).[`tag`](Property.md#tag)

## Accessors

### name

#### Get Signature

> **get** **name**(): `string`

Defined in: [property.mjs:104](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L104)

Property name (`tag.name.value`), or null for a tag-less / synthetic property.

##### Returns

`string`

#### Inherited from

[`Property`](Property.md).[`name`](Property.md#name)

***

### type

#### Get Signature

> **get** **type**(): `string`

Defined in: [property.mjs:106](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L106)

Property UE type (`tag.type.value`), or null.

##### Returns

`string`

#### Inherited from

[`Property`](Property.md).[`type`](Property.md#type)

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `tag`, `sizeHint`, `ctx`): `OpaqueProperty`

Defined in: [properties/opaque.mjs:103](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L103)

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

`OpaqueProperty`

#### Overrides

[`Property`](Property.md).[`fromReader`](Property.md#fromreader)

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

#### Overrides

[`Property`](Property.md).[`_writeValue`](Property.md#_writevalue)

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

#### Overrides

[`Property`](Property.md).[`_writeJSON`](Property.md#_writejson)

***

### fromJSON()

> `static` **fromJSON**(`j`): `OpaqueProperty`

Defined in: [properties/opaque.mjs:119](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/opaque.mjs#L119)

Reconstruct a Property from its JSON form. Dispatches on `j.type`;
unknown types fall through to the opaque fallback.

#### Parameters

##### j

`any`

#### Returns

`OpaqueProperty`

#### Throws

when no handler and no opaque fallback are registered.

#### Overrides

[`Property`](Property.md).[`fromJSON`](Property.md#fromjson)

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

[`Property`](Property.md).[`toBytes`](Property.md#tobytes)

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property.mjs:179](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L179)

Flat JSON shape: tag fields + value fields merged into one object via
the subclass's `_writeJSON`. Inverse of `Property.fromJSON`.

#### Returns

`any`

#### Inherited from

[`Property`](Property.md).[`toJSON`](Property.md#tojson)
