[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [primitives](../README.md) / FNameJSON

# Interface: FNameJSON

Defined in: [primitives.mjs:26](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L26)

## Properties

### value

> **value**: `string`

Defined in: [primitives.mjs:27](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L27)

The bare name.

***

### isUnicode

> **isUnicode**: `boolean`

Defined in: [primitives.mjs:28](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L28)

Wire encoding (null = auto-detect on write).

***

### isNull

> **isNull**: `boolean`

Defined in: [primitives.mjs:29](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L29)

SaveNum=0 vs. empty-with-terminator marker (only meaningful for `value === ''`).

***

### number

> **number**: `number`

Defined in: [primitives.mjs:30](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/primitives.mjs#L30)

FName.Number suffix (zero in every observed Soulmask FName).
