[**wscodec**](../../README.md)

***

[wscodec](../../README.md) / [wscodec](../README.md) / STRUCT\_HANDLERS

# Variable: STRUCT\_HANDLERS

> `const` **STRUCT\_HANDLERS**: `object`

Defined in: [properties/struct.mjs:41](https://github.com/auroris/SoulmaskCodec/blob/main/src/properties/struct.mjs#L41)

## Type Declaration

### Vector

> **Vector**: `object`

#### Vector.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### x

> **x**: `any`

###### y

> **y**: `any`

###### z

> **z**: `any`

#### Vector.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Vector2D

> **Vector2D**: `object`

#### Vector2D.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### x

> **x**: `any`

###### y

> **y**: `any`

#### Vector2D.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Vector4

> **Vector4**: `object`

#### Vector4.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### x

> **x**: `any`

###### y

> **y**: `any`

###### z

> **z**: `any`

###### w

> **w**: `any`

#### Vector4.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Rotator

> **Rotator**: `object`

#### Rotator.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### pitch

> **pitch**: `any`

###### yaw

> **yaw**: `any`

###### roll

> **roll**: `any`

#### Rotator.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Quat

> **Quat**: `object`

#### Quat.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### x

> **x**: `any`

###### y

> **y**: `any`

###### z

> **z**: `any`

###### w

> **w**: `any`

#### Quat.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Color

> **Color**: `object`

#### Color.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### b

> **b**: `any`

###### g

> **g**: `any`

###### r

> **r**: `any`

###### a

> **a**: `any`

#### Color.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### LinearColor

> **LinearColor**: `object`

#### LinearColor.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### r

> **r**: `any`

###### g

> **g**: `any`

###### b

> **b**: `any`

###### a

> **a**: `any`

#### LinearColor.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Guid

> **Guid**: `object`

#### Guid.read

> **read**: (`c`) => [`FGuid`](../../primitives/classes/FGuid.md)

##### Parameters

###### c

`any`

##### Returns

[`FGuid`](../../primitives/classes/FGuid.md)

#### Guid.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### DateTime

> **DateTime**: `object`

#### DateTime.read

> **read**: (`c`) => `any`

##### Parameters

###### c

`any`

##### Returns

`any`

#### DateTime.write

> **write**: (`w`, `v`) => `any`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`any`

### Timespan

> **Timespan**: `object`

#### Timespan.read

> **read**: (`c`) => `any`

##### Parameters

###### c

`any`

##### Returns

`any`

#### Timespan.write

> **write**: (`w`, `v`) => `any`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`any`

### IntPoint

> **IntPoint**: `object`

#### IntPoint.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### x

> **x**: `any`

###### y

> **y**: `any`

#### IntPoint.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### IntVector

> **IntVector**: `object`

#### IntVector.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### x

> **x**: `any`

###### y

> **y**: `any`

###### z

> **z**: `any`

#### IntVector.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Box

> **Box**: `object`

#### Box.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### min

> **min**: `object`

###### min.x

> **x**: `any`

###### min.y

> **y**: `any`

###### min.z

> **z**: `any`

###### max

> **max**: `object`

###### max.x

> **x**: `any`

###### max.y

> **y**: `any`

###### max.z

> **z**: `any`

###### isValid

> **isValid**: `any`

#### Box.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Sphere

> **Sphere**: `object`

#### Sphere.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### center

> **center**: `object`

###### center.x

> **x**: `any`

###### center.y

> **y**: `any`

###### center.z

> **z**: `any`

###### radius

> **radius**: `any`

#### Sphere.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Plane

> **Plane**: `object`

#### Plane.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### x

> **x**: `any`

###### y

> **y**: `any`

###### z

> **z**: `any`

###### w

> **w**: `any`

#### Plane.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`

### Transform

> **Transform**: `object`

#### Transform.read

> **read**: (`c`) => `object`

##### Parameters

###### c

`any`

##### Returns

`object`

###### rotation

> **rotation**: `object`

###### rotation.x

> **x**: `any`

###### rotation.y

> **y**: `any`

###### rotation.z

> **z**: `any`

###### rotation.w

> **w**: `any`

###### translation

> **translation**: `object`

###### translation.x

> **x**: `any`

###### translation.y

> **y**: `any`

###### translation.z

> **z**: `any`

###### scale3D

> **scale3D**: `object`

###### scale3D.x

> **x**: `any`

###### scale3D.y

> **y**: `any`

###### scale3D.z

> **z**: `any`

#### Transform.write

> **write**: (`w`, `v`) => `void`

##### Parameters

###### w

`any`

###### v

`any`

##### Returns

`void`
