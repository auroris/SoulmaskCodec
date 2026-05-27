[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [io](../README.md) / FStringRead

# Interface: FStringRead

Defined in: [io.mjs:19](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L19)

## Properties

### value

> **value**: `string`

Defined in: [io.mjs:20](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L20)

Decoded string (empty for both null and empty-with-terminator forms).

***

### isUnicode

> **isUnicode**: `boolean`

Defined in: [io.mjs:21](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L21)

True if the wire form used UTF-16 LE (negative SaveNum).

***

### isNull

> **isNull**: `boolean`

Defined in: [io.mjs:22](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/io.mjs#L22)

True if the wire form was SaveNum=0 (no payload) rather than empty-with-terminator.
