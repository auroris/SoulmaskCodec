[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / WeakObjectProperty

# Class: WeakObjectProperty

Defined in: [properties/object.mjs:386](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L386)

UE WeakObjectProperty alias of [ObjectProperty](ObjectProperty.md).

## Extends

- [`ObjectProperty`](ObjectProperty.md)

## Constructors

### Constructor

> **new WeakObjectProperty**(`opts?`): `WeakObjectProperty`

Defined in: [properties/object.mjs:363](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L363)

#### Parameters

##### opts?

###### tag?

[`PropertyTag`](PropertyTag.md)

###### value?

[`ObjectRef`](ObjectRef.md) = `null`

#### Returns

`WeakObjectProperty`

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`constructor`](ObjectProperty.md#constructor)

## Properties

### value

> **value**: [`ObjectRef`](ObjectRef.md)

Defined in: [properties/object.mjs:365](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L365)

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`value`](ObjectProperty.md#value)

***

### tag

> **tag**: [`PropertyTag`](PropertyTag.md)

Defined in: [property.mjs:100](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L100)

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`tag`](ObjectProperty.md#tag)

## Accessors

### name

#### Get Signature

> **get** **name**(): `string`

Defined in: [property.mjs:104](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L104)

Property name (`tag.name.value`), or null for a tag-less / synthetic property.

##### Returns

`string`

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`name`](ObjectProperty.md#name)

***

### type

#### Get Signature

> **get** **type**(): `string`

Defined in: [property.mjs:106](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L106)

Property UE type (`tag.type.value`), or null.

##### Returns

`string`

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`type`](ObjectProperty.md#type)

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `tag`, `sizeHint`, `ctx`): [`ObjectProperty`](ObjectProperty.md)

Defined in: [properties/object.mjs:368](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L368)

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

##### sizeHint

`any`

##### ctx

`any`

Decode context (e.g. `{ strict?: boolean }`).

#### Returns

[`ObjectProperty`](ObjectProperty.md)

#### Throws

on size mismatch or missing opaque fallback.

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`fromReader`](ObjectProperty.md#fromreader)

***

### \_writeValue()

> **\_writeValue**(`w`, `ctx`): `void`

Defined in: [properties/object.mjs:372](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L372)

Write the property's value bytes only — the tag has already been
emitted by `toBytes`. Subclasses must override.

#### Parameters

##### w

`any`

##### ctx

`any`

#### Returns

`void`

#### Throws

on the base class (unimplemented).

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`_writeValue`](ObjectProperty.md#_writevalue)

***

### \_writeJSON()

> **\_writeJSON**(`j`): `void`

Defined in: [properties/object.mjs:374](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L374)

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

[`ObjectProperty`](ObjectProperty.md).[`_writeJSON`](ObjectProperty.md#_writejson)

***

### fromJSON()

> `static` **fromJSON**(`j`): [`ObjectProperty`](ObjectProperty.md)

Defined in: [properties/object.mjs:376](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/object.mjs#L376)

Reconstruct a Property from its JSON form. Dispatches on `j.type`;
unknown types fall through to the opaque fallback.

#### Parameters

##### j

`any`

#### Returns

[`ObjectProperty`](ObjectProperty.md)

#### Throws

when no handler and no opaque fallback are registered.

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`fromJSON`](ObjectProperty.md#fromjson)

***

### toBytes()

> **toBytes**(`writer`, `ctx?`): `void`

Defined in: [property.mjs:154](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L154)

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

[`ObjectProperty`](ObjectProperty.md).[`toBytes`](ObjectProperty.md#tobytes)

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property.mjs:179](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L179)

Flat JSON shape: tag fields + value fields merged into one object via
the subclass's `_writeJSON`. Inverse of `Property.fromJSON`.

#### Returns

`any`

#### Inherited from

[`ObjectProperty`](ObjectProperty.md).[`toJSON`](ObjectProperty.md#tojson)
