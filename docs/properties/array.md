# wscodec/properties/array

Source: [`src/properties/array.mjs`](../src/properties/array.mjs)

<a name="module_wscodec/properties/array"></a>

## wscodec/properties/array
`ArrayProperty`: homogeneous array of values, sized by the outer tag.Wire layout: `[int32 NumElements] [elements...]`- `Array<StructProperty>` additionally carries a single inner PropertyTag  (one shared by all elements) immediately after the count. Each  element is then either a binary record (via `STRUCT_HANDLERS`) or a  nested PropertyStream terminated by None. The inner tag's size on  the wire is the TOTAL byte length of all encoded elements (verified:  `Array<Guid>{6}` has `innerTag.size=96=6*16`).- `Array<ObjectProperty>` elements have variable shapes and no  per-element delimiter; see `object.mjs` for the four-guard decode.  Some Soulmask ObjectProperty arrays (`JianZhuInstYuanXings`:  building-zone yuan-xings) ALSO interleave a placement-binary block  after each kind=3 element - handled by  `_tryReadObjectArrayPerElementBlock` below.- Other inner types (numeric / Str / Name / Enum / Byte / Text / Soft*):  element is the bare value, no per-element wrapper. Reading / writing  / JSON for these delegates to `element-codec.mjs`.The placement-binary block per kind=3 yuan-xing:  [8 bytes zero header]  [u32 stride=64] [u32 count]  [count * 16 float32]   transforms (4x4)  [u32 stride= 4] [u32 count]  [count * u32]          ids  [u32 stride=64] [u32 count]  [count * 16 float32]   aux (bbox + scale)Verified in-game 2026-05-18: `numElements` counts UNIQUE prototypes(foundation, wall, door frame, ...); `transforms.length` is theplaced-piece count per prototype; `aux.length` is typically equal orone greater.NaN bit patterns inside the float32 sections are common in Soulmask auxdata (observed 0xFFFFFFFF as an "invalid" sentinel) and would collapseto canonical 0x7FC00000 if round-tripped via a JS Number. We capturenon-canonical NaNs as `{ $nanBits: u32 }` wrappers.


* [wscodec/properties/array](#module_wscodec/properties/array)
    * [.ArrayProperty](#module_wscodec/properties/array.ArrayProperty)
        * [new exports.ArrayProperty([fields])](#new_module_wscodec/properties/array.ArrayProperty_new)

<a name="module_wscodec/properties/array.ArrayProperty"></a>

### wscodec/properties/array.ArrayProperty
Property wrapping a homogeneous array. See the module description for thewire layout, per-inner-type variations, and the Soulmask-specificplacement-binary trailing block.

**Kind**: static class of [<code>wscodec/properties/array</code>](#module_wscodec/properties/array)  
<a name="new_module_wscodec/properties/array.ArrayProperty_new"></a>

#### new exports.ArrayProperty([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.tag] | <code>PropertyTag</code> |  |  |
| [fields.elements] | <code>Array.&lt;\*&gt;</code> | <code>[]</code> | Decoded element values; shape depends on `tag.innerType`. |
| [fields.innerTag] | <code>PropertyTag</code> \| <code>null</code> | <code></code> | Inner PropertyTag for `Array<StructProperty>`. |
| [fields.innerTagSize] | <code>number</code> \| <code>null</code> | <code></code> | Original wire value of `innerTag.size`, captured for byte-identical round-trip. |
| [fields.perElementTrailings] | <code>Array.&lt;({transforms: Array.&lt;Array.&lt;number&gt;&gt;, ids: Array.&lt;number&gt;, aux: Array.&lt;Array.&lt;number&gt;&gt;}\|null)&gt;</code> \| <code>null</code> | <code></code> | Per-element placement-binary blocks for `Array<ObjectProperty>` (Soulmask `JianZhuInstYuanXings`); null when not present. |
