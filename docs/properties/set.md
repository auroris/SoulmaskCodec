# wscodec/properties/set

Source: [`src/properties/set.mjs`](../src/properties/set.mjs)

<a name="module_wscodec/properties/set"></a>

## wscodec/properties/set
`SetProperty`: homogeneous unordered collection with a "removed" listpreceding the active entries.Wire layout: `[int32 NumRemoved] [removed...] [int32 NumElements] [elements...]`Set element shapes match `ArrayProperty`'s element shapes for non-Structinner types and are read/written via the shared element-codec. For`StructProperty` inner type, elements are EITHER raw 16-byte FGuids (thecommon case across Soulmask saves) OR a nested property stream (mirrorsMap<Struct, _> key disambiguation; no Set<Struct> property-stream casehas been observed in saves but the codec stays robust against one).The two are distinguished by peeking with `peekLooksLikePropertyTag` -random FGuid bytes effectively never satisfy the identifier-FStringtest, so this peek is safe.`Set<ObjectProperty>` isn't exercised by observed Soulmask data; theelement-codec dispatches with `Infinity` sizeHint in that case, whichis approximate but should work for the standard wire shape (kind +path + optional classPath).


* [wscodec/properties/set](#module_wscodec/properties/set)
    * [.SetProperty](#module_wscodec/properties/set.SetProperty)
        * [new exports.SetProperty([fields])](#new_module_wscodec/properties/set.SetProperty_new)

<a name="module_wscodec/properties/set.SetProperty"></a>

### wscodec/properties/set.SetProperty
Property wrapping a set (with a separate "removed" list). The on-wireorder of elements is preserved on `this.elements`.

**Kind**: static class of [<code>wscodec/properties/set</code>](#module_wscodec/properties/set)  
<a name="new_module_wscodec/properties/set.SetProperty_new"></a>

#### new exports.SetProperty([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.tag] | <code>PropertyTag</code> |  |  |
| [fields.removed] | <code>Array.&lt;\*&gt;</code> | <code>[]</code> | Removed keys (shape matches `elements`). |
| [fields.elements] | <code>Array.&lt;\*&gt;</code> | <code>[]</code> | Active entries. |
