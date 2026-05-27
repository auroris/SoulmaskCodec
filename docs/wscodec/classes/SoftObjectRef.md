[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / SoftObjectRef

# Class: SoftObjectRef

Defined in: [properties/soft-object.mjs:19](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/soft-object.mjs#L19)

Decoded SoftObjectProperty value: an `assetPath` plus an optional `subPath`
pointing inside a level / sublevel.

## Constructors

### Constructor

> **new SoftObjectRef**(`opts?`): `SoftObjectRef`

Defined in: [properties/soft-object.mjs:25](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/soft-object.mjs#L25)

#### Parameters

##### opts?

###### assetPath?

`string` = `''`

###### subPath?

`string` = `''`

#### Returns

`SoftObjectRef`

## Properties

### assetPath

> **assetPath**: `string`

Defined in: [properties/soft-object.mjs:26](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/soft-object.mjs#L26)

***

### subPath

> **subPath**: `string`

Defined in: [properties/soft-object.mjs:27](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/soft-object.mjs#L27)

## Methods

### fromReader()

> `static` **fromReader**(`cursor`): `SoftObjectRef`

Defined in: [properties/soft-object.mjs:34](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/soft-object.mjs#L34)

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

#### Returns

`SoftObjectRef`

***

### toBytes()

> **toBytes**(`writer`): `void`

Defined in: [properties/soft-object.mjs:42](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/soft-object.mjs#L42)

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

#### Returns

`void`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [properties/soft-object.mjs:47](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/soft-object.mjs#L47)

#### Returns

`object`

##### assetPath

> **assetPath**: `string`

##### subPath

> **subPath**: `string`

***

### fromJSON()

> `static` **fromJSON**(`j`): `SoftObjectRef`

Defined in: [properties/soft-object.mjs:52](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/properties/soft-object.mjs#L52)

#### Parameters

##### j

###### assetPath

`string`

###### subPath

`string`

#### Returns

`SoftObjectRef`
