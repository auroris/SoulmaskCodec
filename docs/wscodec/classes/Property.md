[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / Property

# Class: Property

Defined in: [property.mjs:94](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L94)

Base class for every UE property type. The base implements the common
"read tag, dispatch to subclass, validate byte count" decode flow and the
"write tag, write value, back-patch size" encode flow; subclasses provide
`static fromReader`, instance `_writeValue`, and `toJSON`/`fromJSON`.

## Extended by

- [`BoolProperty`](BoolProperty.md)
- [`StrProperty`](StrProperty.md)
- [`ByteProperty`](ByteProperty.md)
- [`ObjectProperty`](ObjectProperty.md)
- [`SoftObjectProperty`](SoftObjectProperty.md)
- [`StructProperty`](StructProperty.md)
- [`ArrayProperty`](ArrayProperty.md)
- [`SetProperty`](SetProperty.md)
- [`MapProperty`](MapProperty.md)
- [`TextProperty`](TextProperty.md)
- [`OpaqueProperty`](OpaqueProperty.md)

## Constructors

### Constructor

> **new Property**(`opts?`): `Property`

Defined in: [property.mjs:99](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L99)

#### Parameters

##### opts?

###### tag?

[`PropertyTag`](PropertyTag.md)

#### Returns

`Property`

## Properties

### tag

> **tag**: [`PropertyTag`](PropertyTag.md)

Defined in: [property.mjs:100](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L100)

## Accessors

### name

#### Get Signature

> **get** **name**(): `string`

Defined in: [property.mjs:104](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L104)

Property name (`tag.name.value`), or null for a tag-less / synthetic property.

##### Returns

`string`

***

### type

#### Get Signature

> **get** **type**(): `string`

Defined in: [property.mjs:106](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L106)

Property UE type (`tag.type.value`), or null.

##### Returns

`string`

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `ctx?`): `Property`

Defined in: [property.mjs:122](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L122)

Read one property: tag + value. Throws on size mismatch (the value
reader consumed a different number of bytes than the tag claimed —
that's a codec bug).

Returns a `TerminatorProperty` when the tag's Name was "None"; the
caller (typically `PropertyStream.fromReader`) treats that as the
stream terminator and does not append it to the result list.

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

##### ctx?

`any` = `{}`

Decode context (e.g. `{ strict?: boolean }`).

#### Returns

`Property`

#### Throws

on size mismatch or missing opaque fallback.

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

***

### \_writeValue()

> **\_writeValue**(`_writer`, `_ctx?`): `void`

Defined in: [property.mjs:169](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L169)

Write the property's value bytes only — the tag has already been
emitted by `toBytes`. Subclasses must override.

#### Parameters

##### \_writer

[`Writer`](../../io/classes/Writer.md)

##### \_ctx?

`any`

#### Returns

`void`

#### Throws

on the base class (unimplemented).

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property.mjs:179](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L179)

Flat JSON shape: tag fields + value fields merged into one object via
the subclass's `_writeJSON`. Inverse of `Property.fromJSON`.

#### Returns

`any`

***

### \_writeJSON()

> **\_writeJSON**(`_j`): `void`

Defined in: [property.mjs:196](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L196)

Add this property's value fields to the JSON object already populated
with tag fields. Subclasses must override.

#### Parameters

##### \_j

`any`

#### Returns

`void`

#### Throws

on the base class (unimplemented).

***

### fromJSON()

> `static` **fromJSON**(`j`): `Property`

Defined in: [property.mjs:208](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L208)

Reconstruct a Property from its JSON form. Dispatches on `j.type`;
unknown types fall through to the opaque fallback.

#### Parameters

##### j

`any`

#### Returns

`Property`

#### Throws

when no handler and no opaque fallback are registered.
