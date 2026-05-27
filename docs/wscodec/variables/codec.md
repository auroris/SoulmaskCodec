[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / codec

# Variable: codec

> `const` **codec**: `object`

Defined in: [blob.mjs:235](https://github.com/auroris/SoulmaskCodec/blob/main/src/blob.mjs#L235)

wscodec: pure-JS codec for Soulmask actor_data property streams.

Public surface re-exports — `import { UnrealBlob, FName, FGuid, ... }
from 'wscodec';` works without reaching into individual submodules.

Wire layout, top-level API, and Soulmask actor_data envelope are
documented in `blob.mjs`. Property class hierarchy and the recursive
fromReader/toBytes pattern are documented in `property.mjs`.

## Type Declaration

### name

> **name**: `string` = `NAME`

### detect

> **detect**: (`u8`) => `boolean`

#### Parameters

##### u8

`any`

#### Returns

`boolean`

### decode

> **decode**: (`u8`) => [`UnrealBlob`](../classes/UnrealBlob.md)

#### Parameters

##### u8

`any`

#### Returns

[`UnrealBlob`](../classes/UnrealBlob.md)

### encode

> **encode**: (`blob`) => `any`

#### Parameters

##### blob

`any`

#### Returns

`any`
