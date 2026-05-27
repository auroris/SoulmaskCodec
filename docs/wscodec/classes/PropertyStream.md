[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / PropertyStream

# Class: PropertyStream

Defined in: [property-stream.mjs:29](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L29)

Ordered list of properties terminated by a `None` tag. The recursive unit
of the codec: appears at the top level of an UnrealBlob, inside
unknown-shape StructProperty values, inside ObjectRef.embedded, and as
array/set/map struct elements.

## Constructors

### Constructor

> **new PropertyStream**(`opts?`): `PropertyStream`

Defined in: [property-stream.mjs:36](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L36)

#### Parameters

##### opts?

###### properties?

[`Property`](Property.md)[] = `[]`

###### terminated?

`boolean` = `false`

True iff the wire data ended with a `None` tag.

###### terminatorTrailer?

`boolean` = `false`

True iff a 4-byte FName.Number=0 trailer followed the `None`.

#### Returns

`PropertyStream`

## Properties

### properties

> **properties**: [`Property`](Property.md)[]

Defined in: [property-stream.mjs:37](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L37)

***

### terminated

> **terminated**: `boolean`

Defined in: [property-stream.mjs:38](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L38)

***

### terminatorTrailer

> **terminatorTrailer**: `boolean`

Defined in: [property-stream.mjs:39](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L39)

## Methods

### fromReader()

> `static` **fromReader**(`cursor`, `endOffset?`, `opts?`): `PropertyStream`

Defined in: [property-stream.mjs:57](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L57)

Read properties until either a None terminator or `endOffset` is reached.

`consumeTerminatorTrailer` is true for the outermost stream. For nested
streams pass false; callers (e.g. ObjectRef) that detect a trailer in
the embedded byte budget set `terminatorTrailer` on the resulting
stream after the fact (see `attachTerminatorTrailer`).

#### Parameters

##### cursor

[`Cursor`](../../io/classes/Cursor.md)

##### endOffset?

`number` = `Infinity`

Absolute cursor offset at which to stop (default: read to EOF).

##### opts?

###### consumeTerminatorTrailer?

`boolean` = `false`

###### ctx?

`any` = `{}`

Decode context (e.g. `{ strict?: boolean }`).

#### Returns

`PropertyStream`

***

### toBytes()

> **toBytes**(`writer`, `opts?`): `void`

Defined in: [property-stream.mjs:86](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L86)

Write the properties, then a None terminator. The trailer (4-byte
FName.Number=0) is emitted when `this.terminatorTrailer` is true OR
the caller passes `emitTerminatorTrailer: true` (top-level stream).

#### Parameters

##### writer

[`Writer`](../../io/classes/Writer.md)

##### opts?

###### emitTerminatorTrailer?

`boolean` = `false`

###### ctx?

`any` = `{}`

#### Returns

`void`

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property-stream.mjs:95](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L95)

#### Returns

`any`

***

### fromJSON()

> `static` **fromJSON**(`j`): `PropertyStream`

Defined in: [property-stream.mjs:106](https://github.com/auroris/SoulmaskCodec/blob/main/src/property-stream.mjs#L106)

#### Parameters

##### j

`any`

#### Returns

`PropertyStream`
