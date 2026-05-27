[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / UnrealBlob

# Class: UnrealBlob

Defined in: [blob.mjs:60](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L60)

Top-level codec object. Wraps a [PropertyStream](PropertyStream.md) plus the 4-byte
version header and any trailing bytes after the terminator.

## Constructors

### Constructor

> **new UnrealBlob**(`opts?`): `UnrealBlob`

Defined in: [blob.mjs:67](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L67)

#### Parameters

##### opts?

###### versionTag?

`number` = `VERSION_TAG`

Wire-format DataVersion (defaults to [VERSION\_TAG](../variables/VERSION_TAG.md)).

###### stream?

[`PropertyStream`](PropertyStream.md) = `null`

###### bodyTrailing?

`Uint8Array`\<`ArrayBufferLike`\> = `null`

Unparsed bytes after the terminator, if any.

#### Returns

`UnrealBlob`

## Properties

### versionTag

> **versionTag**: `number`

Defined in: [blob.mjs:68](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L68)

***

### stream

> **stream**: [`PropertyStream`](PropertyStream.md)

Defined in: [blob.mjs:69](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L69)

***

### bodyTrailing

> **bodyTrailing**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [blob.mjs:70](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L70)

## Accessors

### kind

#### Get Signature

> **get** **kind**(): `string`

Defined in: [blob.mjs:74](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L74)

Codec-adapter name. Matches the `name` field on the bare `codec` export.

##### Returns

`string`

***

### properties

#### Get Signature

> **get** **properties**(): [`Property`](Property.md)[]

Defined in: [blob.mjs:81](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L81)

Convenience accessor for the top-level property list. Equivalent to
`this.stream.properties` — exposes the canonical place to add/remove
properties at the top level.

##### Returns

[`Property`](Property.md)[]

***

### terminated

#### Get Signature

> **get** **terminated**(): `boolean`

Defined in: [blob.mjs:84](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L84)

True iff the property stream was successfully terminated by a None tag.

##### Returns

`boolean`

## Methods

### findProperty()

> **findProperty**(`propName`): [`Property`](Property.md)

Defined in: [blob.mjs:94](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L94)

First TOP-LEVEL property with the given tag name, or null. Does NOT
traverse into embedded streams, struct values, array elements, or map
entries — use `findPropertyDeep` for that.

#### Parameters

##### propName

`string`

#### Returns

[`Property`](Property.md)

***

### findPropertyDeep()

> **findPropertyDeep**(`propName`): [`Property`](Property.md)

Defined in: [blob.mjs:113](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L113)

Depth-first search for the first property with the given tag name,
anywhere in the tree. Walks:
  - top-level properties
  - ObjectRef.embedded (PropertyStream)
  - StructValue's propStream form
  - ArrayProperty / SetProperty StructValue elements + ObjectRef embeddeds
  - MapProperty entries: both key (when StructValue) and value

#### Parameters

##### propName

`string`

#### Returns

[`Property`](Property.md)

***

### detect()

> `static` **detect**(`u8`): `boolean`

Defined in: [blob.mjs:124](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L124)

True iff `u8` starts with the wscodec wire header. Cheap header sniff;
doesn't validate the rest of the structure.

#### Parameters

##### u8

`Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`boolean`

***

### fromBytes()

> `static` **fromBytes**(`u8`, `opts?`): `UnrealBlob`

Defined in: [blob.mjs:143](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L143)

Parse uncompressed property-stream bytes. Always throws on size
mismatch (codec bug) or any other structural failure; the
`opts.strict` flag additionally escalates every opaque-fallback site
(unknown property type, FText unknown historyType, etc.) into a thrown
Error rather than a warn-and-capture.

#### Parameters

##### u8

`Uint8Array`\<`ArrayBufferLike`\>

##### opts?

###### strict?

`boolean`

#### Returns

`UnrealBlob`

#### Throws

on header mismatch or structural failure.

***

### toBytes()

> **toBytes**(): `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [blob.mjs:175](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L175)

Re-encode this blob to bytes. Always recomputes every tag size from
actually-encoded value bytes; there is no pass-through path.

#### Returns

`Uint8Array`\<`ArrayBufferLike`\>

***

### toJSON()

> **toJSON**(): `any`

Defined in: [blob.mjs:190](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L190)

Build a JSON-safe tree. `bodyTrailing` is base64-encoded.

#### Returns

`any`

***

### fromJSON()

> `static` **fromJSON**(`j`): `UnrealBlob`

Defined in: [blob.mjs:205](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L205)

#### Parameters

##### j

`any`

#### Returns

`UnrealBlob`

***

### toJSONString()

> **toJSONString**(`indent?`): `string`

Defined in: [blob.mjs:219](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L219)

Stringify with -0 / NaN / Infinity preserved via sentinel substitution.

#### Parameters

##### indent?

`string` \| `number`

Passed through to `JSON.stringify`.

#### Returns

`string`

***

### fromJSONString()

> `static` **fromJSONString**(`s`): `UnrealBlob`

Defined in: [blob.mjs:227](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L227)

Parse + reconstruct, undoing the sentinel substitution.

#### Parameters

##### s

`string`

#### Returns

`UnrealBlob`
