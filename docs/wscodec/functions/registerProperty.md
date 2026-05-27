[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / registerProperty

# Function: registerProperty()

> **registerProperty**(`typeName`, `cls`): `void`

Defined in: [property.mjs:49](https://github.com/auroris/SoulmaskCodec/blob/01650b5ab2daafd45d409b4889cbcd65d3712d4a/src/property.mjs#L49)

Register a Property subclass under its UE type name (e.g. `'IntProperty'`,
`'StructProperty'`). Called by each property file at module load.

## Parameters

### typeName

`string`

UE wire-format type name.

### cls

*typeof* [`Property`](../classes/Property.md)

## Returns

`void`
