[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / BoolProperty

# Class: BoolProperty

Defined in: [properties/leaf.mjs:79](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/leaf.mjs#L79)

Boolean property. The wire byte lives in `tag.boolVal`, not in the value
payload — `Property.toBytes` writes the tag with size=0 and an empty
value buffer. The `value` accessor is a getter/setter over `tag.boolVal`
so the two cannot go stale relative to each other.

## Extends

- [`Property`](Property.md)

## Constructors

### Constructor

> **new BoolProperty**(`opts?`): `BoolProperty`

Defined in: [properties/leaf.mjs:85](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/leaf.mjs#L85)

#### Parameters

##### opts?

###### tag?

[`PropertyTag`](PropertyTag.md)

###### value?

`boolean` = `false`

#### Returns

`BoolProperty`

#### Overrides

[`Property`](Property.md).[`constructor`](Property.md#constructor)

## Properties

### tag

> **tag**: [`PropertyTag`](PropertyTag.md)

Defined in: [property.mjs:100](https://github.com/auroris/SoulmaskCodec/blob/main/src/property.mjs#L100)

#### Inherited from

[`Property`](Property.md).[`tag`](Property.md#tag)

## Accessors

### value

#### Get Signature

> **get** **value**(): `boolean`

Defined in: [properties/leaf.mjs:89](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/leaf.mjs#L89)

##### Returns

`boolean`

#### Set Signature

> **set** **value**(`v`): `void`

Defined in: [properties/leaf.mjs:90](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/leaf.mjs#L90)

##### Parameters

###### v

`boolean`

##### Returns

`void`

***

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

> `static` **fromReader**(`_cursor`, `tag`): `BoolProperty`

Defined in: [properties/leaf.mjs:92](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/leaf.mjs#L92)

Read one property: tag + value. Throws on size mismatch (the value
reader consumed a different number of bytes than the tag claimed —
that's a codec bug).

Returns a `TerminatorProperty` when the tag's Name was "None"; the
caller (typically `PropertyStream.fromReader`) treats that as the
stream terminator and does not append it to the result list.

#### Parameters

##### \_cursor

`any`

##### tag

`any`

#### Returns

`BoolProperty`

#### Throws

on size mismatch or missing opaque fallback.

#### Overrides

[`Property`](Property.md).[`fromReader`](Property.md#fromreader)

***

### \_writeValue()

> **\_writeValue**(`_w`): `void`

Defined in: [properties/leaf.mjs:95](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/leaf.mjs#L95)

Write the property's value bytes only — the tag has already been
emitted by `toBytes`. Subclasses must override.

#### Parameters

##### \_w

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

Defined in: [properties/leaf.mjs:98](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/leaf.mjs#L98)

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

> `static` **fromJSON**(`j`): `BoolProperty`

Defined in: [properties/leaf.mjs:99](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/leaf.mjs#L99)

Reconstruct a Property from its JSON form. Dispatches on `j.type`;
unknown types fall through to the opaque fallback.

#### Parameters

##### j

`any`

#### Returns

`BoolProperty`

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
