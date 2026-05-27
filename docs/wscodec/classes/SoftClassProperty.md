[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / SoftClassProperty

# Class: SoftClassProperty

Defined in: [properties/soft-object.mjs:83](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/soft-object.mjs#L83)

UE SoftClassProperty: identical wire layout to [SoftObjectProperty](SoftObjectProperty.md);
separate class so `tag.type` round-trips faithfully.

## Extends

- [`SoftObjectProperty`](SoftObjectProperty.md)

## Constructors

### Constructor

> **new SoftClassProperty**(`opts?`): `SoftClassProperty`

Defined in: [properties/soft-object.mjs:65](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/soft-object.mjs#L65)

#### Parameters

##### opts?

###### tag?

[`PropertyTag`](PropertyTag.md)

###### value?

[`SoftObjectRef`](SoftObjectRef.md) = `null`

#### Returns

`SoftClassProperty`

#### Inherited from

[`SoftObjectProperty`](SoftObjectProperty.md).[`constructor`](SoftObjectProperty.md#constructor)

## Properties

### value

> **value**: [`SoftObjectRef`](SoftObjectRef.md)

Defined in: [properties/soft-object.mjs:67](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/soft-object.mjs#L67)

#### Inherited from

[`SoftObjectProperty`](SoftObjectProperty.md).[`value`](SoftObjectProperty.md#value)

***

### tag

> **tag**: [`PropertyTag`](PropertyTag.md)

Defined in: [property.mjs:100](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L100)

#### Inherited from

[`SoftObjectProperty`](SoftObjectProperty.md).[`tag`](SoftObjectProperty.md#tag)

## Accessors

### name

#### Get Signature

> **get** **name**(): `string`

Defined in: [property.mjs:104](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L104)

Property name (`tag.name.value`), or null for a tag-less / synthetic property.

##### Returns

`string`

#### Inherited from

[`SoftObjectProperty`](SoftObjectProperty.md).[`name`](SoftObjectProperty.md#name)

***

### type

#### Get Signature

> **get** **type**(): `string`

Defined in: [property.mjs:106](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L106)

Property UE type (`tag.type.value`), or null.

##### Returns

`string`

#### Inherited from

[`SoftObjectProperty`](SoftObjectProperty.md).[`type`](SoftObjectProperty.md#type)

## Methods

### \_writeValue()

> **\_writeValue**(`w`): `void`

Defined in: [properties/soft-object.mjs:72](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/soft-object.mjs#L72)

Write the property's value bytes only — the tag has already been
emitted by `toBytes`. Subclasses must override.

#### Parameters

##### w

`any`

#### Returns

`void`

#### Throws

on the base class (unimplemented).

#### Inherited from

[`SoftObjectProperty`](SoftObjectProperty.md).[`_writeValue`](SoftObjectProperty.md#_writevalue)

***

### \_writeJSON()

> **\_writeJSON**(`j`): `void`

Defined in: [properties/soft-object.mjs:73](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/soft-object.mjs#L73)

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

[`SoftObjectProperty`](SoftObjectProperty.md).[`_writeJSON`](SoftObjectProperty.md#_writejson)

***

### fromReader()

> `static` **fromReader**(`cursor`, `tag`): `SoftClassProperty`

Defined in: [properties/soft-object.mjs:84](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/soft-object.mjs#L84)

Read one property: tag + value. Throws on size mismatch (the value
reader consumed a different number of bytes than the tag claimed —
that's a codec bug).

Returns a `TerminatorProperty` when the tag's Name was "None"; the
caller (typically `PropertyStream.fromReader`) treats that as the
stream terminator and does not append it to the result list.

#### Parameters

##### cursor

`any`

##### tag

`any`

#### Returns

`SoftClassProperty`

#### Throws

on size mismatch or missing opaque fallback.

#### Overrides

[`SoftObjectProperty`](SoftObjectProperty.md).[`fromReader`](SoftObjectProperty.md#fromreader)

***

### fromJSON()

> `static` **fromJSON**(`j`): `SoftClassProperty`

Defined in: [properties/soft-object.mjs:87](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/soft-object.mjs#L87)

Reconstruct a Property from its JSON form. Dispatches on `j.type`;
unknown types fall through to the opaque fallback.

#### Parameters

##### j

`any`

#### Returns

`SoftClassProperty`

#### Throws

when no handler and no opaque fallback are registered.

#### Overrides

[`SoftObjectProperty`](SoftObjectProperty.md).[`fromJSON`](SoftObjectProperty.md#fromjson)

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

[`SoftObjectProperty`](SoftObjectProperty.md).[`toBytes`](SoftObjectProperty.md#tobytes)

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property.mjs:179](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L179)

Flat JSON shape: tag fields + value fields merged into one object via
the subclass's `_writeJSON`. Inverse of `Property.fromJSON`.

#### Returns

`any`

#### Inherited from

[`SoftObjectProperty`](SoftObjectProperty.md).[`toJSON`](SoftObjectProperty.md#tojson)
