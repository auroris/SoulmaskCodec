[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / warnOrThrow

# Function: warnOrThrow()

> **warnOrThrow**(`ctx?`, `message`): `void`

Defined in: [property.mjs:80](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L80)

Surface a codec-degradation event (opaque fallback, unknown type, etc.).
Default behavior is a console.warn; `ctx.strict === true` escalates to a
thrown Error. Use this at every decode site that would otherwise silently
round-trip unparsed bytes.

## Parameters

### ctx?

`any`

Decode context (e.g. `{ strict?: boolean }`).

### message

`string`

## Returns

`void`

## Throws

when `ctx.strict` is true.
