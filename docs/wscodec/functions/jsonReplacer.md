[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / jsonReplacer

# Function: jsonReplacer()

> **jsonReplacer**(`_key`, `value`): `any`

Defined in: [blob.mjs:267](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/blob.mjs#L267)

`JSON.stringify` replacer that substitutes sentinels for -0 / Infinity /
NaN. Pass this to any `JSON.stringify` call that may contain
wscodec-derived numbers (including a blob nested inside a larger
envelope). Use `jsonReviver` on the matching `JSON.parse` to invert.

## Parameters

### \_key

`string`

### value

`any`

## Returns

`any`
