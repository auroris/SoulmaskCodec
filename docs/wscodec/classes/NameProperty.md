[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / NameProperty

# Class: NameProperty

Defined in: [properties/leaf.mjs:179](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/leaf.mjs#L179)

FName-valued property (e.g. an asset reference or a tag name).

## Extends

- `_FNameLeaf`

## Constructors

### Constructor

> **new NameProperty**(`opts?`): `NameProperty`

Defined in: [properties/leaf.mjs:168](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/leaf.mjs#L168)

#### Parameters

##### opts?

###### tag?

[`PropertyTag`](PropertyTag.md)

###### value?

`string` \| [`FName`](../../primitives/classes/FName.md) = `null`

#### Returns

`NameProperty`

#### Inherited from

`_FNameLeaf.constructor`

## Properties

### value

> **value**: `string` \| [`FName`](../../primitives/classes/FName.md)

Defined in: [properties/leaf.mjs:170](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/leaf.mjs#L170)

#### Inherited from

`_FNameLeaf.value`

***

### tag

> **tag**: [`PropertyTag`](PropertyTag.md)

Defined in: [property.mjs:100](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L100)

#### Inherited from

`_FNameLeaf.tag`

## Accessors

### name

#### Get Signature

> **get** **name**(): `string`

Defined in: [property.mjs:104](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L104)

Property name (`tag.name.value`), or null for a tag-less / synthetic property.

##### Returns

`string`

#### Inherited from

`_FNameLeaf.name`

***

### type

#### Get Signature

> **get** **type**(): `string`

Defined in: [property.mjs:106](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L106)

Property UE type (`tag.type.value`), or null.

##### Returns

`string`

#### Inherited from

`_FNameLeaf.type`

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `tag`): `_FNameLeaf`

Defined in: [properties/leaf.mjs:172](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/leaf.mjs#L172)

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

`_FNameLeaf`

#### Throws

on size mismatch or missing opaque fallback.

#### Inherited from

`_FNameLeaf.fromReader`

***

### \_writeValue()

> **\_writeValue**(`w`): `void`

Defined in: [properties/leaf.mjs:173](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/leaf.mjs#L173)

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

`_FNameLeaf._writeValue`

***

### \_writeJSON()

> **\_writeJSON**(`j`): `void`

Defined in: [properties/leaf.mjs:174](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/leaf.mjs#L174)

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

`_FNameLeaf._writeJSON`

***

### fromJSON()

> `static` **fromJSON**(`j`): `_FNameLeaf`

Defined in: [properties/leaf.mjs:175](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/leaf.mjs#L175)

Reconstruct a Property from its JSON form. Dispatches on `j.type`;
unknown types fall through to the opaque fallback.

#### Parameters

##### j

`any`

#### Returns

`_FNameLeaf`

#### Throws

when no handler and no opaque fallback are registered.

#### Inherited from

`_FNameLeaf.fromJSON`

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

`_FNameLeaf.toBytes`

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property.mjs:179](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L179)

Flat JSON shape: tag fields + value fields merged into one object via
the subclass's `_writeJSON`. Inverse of `Property.fromJSON`.

#### Returns

`any`

#### Inherited from

`_FNameLeaf.toJSON`
