[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / PropertyTag

# Class: PropertyTag

Defined in: [tag.mjs:74](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L74)

Header preceding each property's value bytes. Carries the property's
name, type, byte size, and any per-type extension fields (struct name,
inner type for arrays, bool value, enum name, etc.).

Construct directly only when synthesizing a property (e.g. in tests);
normal use is through [PropertyTag.fromReader](#fromreader) or
[PropertyTag.fromJSON](#fromjson).

## Constructors

### Constructor

> **new PropertyTag**(`fields?`): `PropertyTag`

Defined in: [tag.mjs:90](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L90)

#### Parameters

##### fields?

###### name?

[`FName`](../../primitives/classes/FName.md)

###### type?

[`FName`](../../primitives/classes/FName.md)

###### arrayIndex?

`number`

###### structName?

[`FName`](../../primitives/classes/FName.md)

###### structGuid?

[`FGuid`](../../primitives/classes/FGuid.md)

###### boolVal?

`number`

###### enumName?

[`FName`](../../primitives/classes/FName.md)

###### innerType?

[`FName`](../../primitives/classes/FName.md)

###### valueType?

[`FName`](../../primitives/classes/FName.md)

###### hasPropertyGuid?

`boolean`

###### propertyGuid?

[`FGuid`](../../primitives/classes/FGuid.md)

###### isTerminator?

`boolean`

#### Returns

`PropertyTag`

## Properties

### name

> **name**: [`FName`](../../primitives/classes/FName.md)

Defined in: [tag.mjs:91](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L91)

***

### type

> **type**: [`FName`](../../primitives/classes/FName.md)

Defined in: [tag.mjs:92](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L92)

***

### arrayIndex

> **arrayIndex**: `number`

Defined in: [tag.mjs:93](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L93)

***

### structName

> **structName**: [`FName`](../../primitives/classes/FName.md)

Defined in: [tag.mjs:94](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L94)

***

### structGuid

> **structGuid**: [`FGuid`](../../primitives/classes/FGuid.md)

Defined in: [tag.mjs:95](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L95)

***

### boolVal

> **boolVal**: `number`

Defined in: [tag.mjs:96](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L96)

***

### enumName

> **enumName**: [`FName`](../../primitives/classes/FName.md)

Defined in: [tag.mjs:97](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L97)

***

### innerType

> **innerType**: [`FName`](../../primitives/classes/FName.md)

Defined in: [tag.mjs:98](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L98)

***

### valueType

> **valueType**: [`FName`](../../primitives/classes/FName.md)

Defined in: [tag.mjs:99](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L99)

***

### hasPropertyGuid

> **hasPropertyGuid**: `boolean`

Defined in: [tag.mjs:100](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L100)

***

### propertyGuid

> **propertyGuid**: [`FGuid`](../../primitives/classes/FGuid.md)

Defined in: [tag.mjs:101](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L101)

***

### isTerminator

> **isTerminator**: `boolean`

Defined in: [tag.mjs:102](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L102)

## Methods

### fromReader()

> `static` **fromReader**(`cursor`): `PropertyTag`

Defined in: [tag.mjs:113](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L113)

Read a PropertyTag from the cursor. The wire `size` field is captured
in `tag._readSize` (transient — used by Property.fromReader as the
value-decoding byte budget, then discarded).

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

#### Returns

`PropertyTag`

***

### toBytes()

> **toBytes**(`writer`): `number`

Defined in: [tag.mjs:144](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L144)

Emit the tag bytes with a zero placeholder for the `size` field, and
return the absolute writer offset of that placeholder so the caller
can patch it once the value bytes have been written. This lets us
encode a property in a single forward pass — no sub-buffering of the
value just to measure its size.

Terminator tags have no size field and no further payload; this
returns -1 so the caller can branch (though in practice terminator
tags are emitted directly via `new FName('None').toBytes(writer)` and
don't pass through this method).

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

#### Returns

`number`

Absolute writer offset of the size placeholder, or -1 for terminator tags.

***

### toJSON()

> **toJSON**(): `any`

Defined in: [tag.mjs:164](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L164)

Flat JSON shape: tag fields and the relevant TAG_EXTRAS entries are
spread into a single object so it merges cleanly with the per-property
value JSON. Inverse of [PropertyTag.fromJSON](#fromjson).

#### Returns

`any`

***

### fromJSON()

> `static` **fromJSON**(`j`): `PropertyTag`

Defined in: [tag.mjs:181](https://github.com/auroris/SoulmaskCodec/blob/main/src/tag.mjs#L181)

Reconstruct a PropertyTag from the JSON shape produced by `toJSON`.

#### Parameters

##### j

`any`

#### Returns

`PropertyTag`
