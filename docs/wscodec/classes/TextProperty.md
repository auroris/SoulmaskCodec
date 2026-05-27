[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / TextProperty

# Class: TextProperty

Defined in: [properties/text.mjs:418](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L418)

UE TextProperty: wraps an [FTextValue](FTextValue.md) (or an
[OpaqueValue](OpaqueValue.md) fallback when decode failed under non-strict mode).

## Extends

- [`Property`](Property.md)

## Constructors

### Constructor

> **new TextProperty**(`opts?`): `TextProperty`

Defined in: [properties/text.mjs:424](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L424)

#### Parameters

##### opts?

###### tag?

[`PropertyTag`](PropertyTag.md)

###### value?

[`OpaqueValue`](OpaqueValue.md) \| [`FTextValue`](FTextValue.md) = `null`

#### Returns

`TextProperty`

#### Overrides

[`Property`](Property.md).[`constructor`](Property.md#constructor)

## Properties

### value

> **value**: [`OpaqueValue`](OpaqueValue.md) \| [`FTextValue`](FTextValue.md)

Defined in: [properties/text.mjs:427](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L427)

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

> `static` **fromReader**(`cursor`, `tag`, `sizeHint`, `ctx`): `TextProperty`

Defined in: [properties/text.mjs:430](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L430)

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

`TextProperty`

#### Throws

on size mismatch or missing opaque fallback.

#### Overrides

[`Property`](Property.md).[`fromReader`](Property.md#fromreader)

***

### \_writeValue()

> **\_writeValue**(`w`): `void`

Defined in: [properties/text.mjs:442](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L442)

Write the property's value bytes only — the tag has already been
emitted by `toBytes`. Subclasses must override.

#### Parameters

##### w

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

Defined in: [properties/text.mjs:444](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L444)

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

> `static` **fromJSON**(`j`): `TextProperty`

Defined in: [properties/text.mjs:446](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/text.mjs#L446)

Reconstruct a Property from its JSON form. Dispatches on `j.type`;
unknown types fall through to the opaque fallback.

#### Parameters

##### j

`any`

#### Returns

`TextProperty`

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
