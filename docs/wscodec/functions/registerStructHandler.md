[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / registerStructHandler

# Function: registerStructHandler()

> **registerStructHandler**(`name`, `handler`): `void`

Defined in: [properties/struct.mjs:89](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L89)

Register (or replace) a struct handler. Use this rather than mutating
STRUCT_HANDLERS directly; this validates handler shape. Without a
handler, an unknown struct name falls through to the property-stream
path.

## Parameters

### name

`string`

Struct name (matches `tag.structName.value`).

### handler

#### read

(`cursor`) => `any`

#### write

(`writer`, `value`) => `void`

## Returns

`void`

## Throws

on invalid handler shape.
