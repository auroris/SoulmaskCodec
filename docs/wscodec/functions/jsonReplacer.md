[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / jsonReplacer

# Function: jsonReplacer()

> **jsonReplacer**(`_key`, `value`): `any`

Defined in: [blob.mjs:267](https://github.com/auroris/SoulmaskCodec/blob/main/src/blob.mjs#L267)

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
