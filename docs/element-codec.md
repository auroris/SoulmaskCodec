# wscodec/element-codec

Source: [`src/element-codec.mjs`](../src/element-codec.mjs)

<a name="module_wscodec/element-codec"></a>

## wscodec/element-codec
Shared element codec for homogeneous container properties.ArrayProperty / SetProperty / MapProperty all need to read/write/JSONelements of a single declared inner type (or two, for Map). The wireshape for any given inner type is identical across containers - thereis no per-element tag wrapper. This module is the single place thatencoding lives.One handler table (`ELEMENT_CODECS`) per inner type provides`{ read, write, toJSON, fromJSON }`; the four exported dispatchfunctions just look up and call. Aliases (Enum->Name, Class/Weak/Lazy/WS->Object, SoftClass->SoftObject) share the same handler sothere is no chance of one accessor drifting from another.`StructProperty` inner type is NOT handled here, because the threecontainers differ in what they do with structs:- ArrayProperty<Struct>: nested PropertyStream per element via  StructValue (with a shared inner PropertyTag).- SetProperty<Struct>: raw 16-byte FGuid per element.- MapProperty<Struct, _>: raw 16-byte FGuid as key.- MapProperty<_, Struct>: nested PropertyStream OR raw FGuid as  value, decided by a peek heuristic.Each container's reader/writer handles its Struct case before delegatingto these helpers for non-Struct cases.`sizeHint` is only consulted for ObjectProperty-family elements(variable wire shape; needs a byte budget for the four-guard decode in`object.mjs`). For all other inner types it's ignored. Set/Map pass`Infinity` because they have no per-element budget - Soulmask datadoesn't exercise Set<Object> / Map<_,Object> so the heuristics haven'tbeen stress-tested in those contexts.


* [wscodec/element-codec](#module_wscodec/element-codec)
    * [.OBJECT_INNER_TYPES](#module_wscodec/element-codec.OBJECT_INNER_TYPES) : <code>Set.&lt;string&gt;</code>
    * [.readElement(cursor, innerType, sizeHint, [ctx])](#module_wscodec/element-codec.readElement) ⇒ <code>\*</code>
    * [.writeElement(writer, innerType, value, [ctx])](#module_wscodec/element-codec.writeElement)
    * [.elementToJSON(value, innerType)](#module_wscodec/element-codec.elementToJSON) ⇒ <code>\*</code>
    * [.elementFromJSON(j, innerType)](#module_wscodec/element-codec.elementFromJSON) ⇒ <code>\*</code>

<a name="module_wscodec/element-codec.OBJECT_INNER_TYPES"></a>

### wscodec/element-codec.OBJECT\_INNER\_TYPES : <code>Set.&lt;string&gt;</code>
Inner-type names that resolve to `ObjectRef` on the wire. Exported socontainers (array.mjs) can branch on object-family without re-listingthe aliases.

**Kind**: static constant of [<code>wscodec/element-codec</code>](#module_wscodec/element-codec)  
<a name="module_wscodec/element-codec.readElement"></a>

### wscodec/element-codec.readElement(cursor, innerType, sizeHint, [ctx]) ⇒ <code>\*</code>
Read one element of `innerType` from the cursor.

**Kind**: static method of [<code>wscodec/element-codec</code>](#module_wscodec/element-codec)  
**Returns**: <code>\*</code> - The decoded value (shape depends on `innerType`).  

| Param | Type | Description |
| --- | --- | --- |
| cursor | <code>Cursor</code> |  |
| innerType | <code>string</code> | Wire type name (e.g. `'IntProperty'`). |
| sizeHint | <code>number</code> | Per-element byte budget. Only consulted for ObjectProperty-family elements. |
| [ctx] | <code>Object</code> |  |

<a name="module_wscodec/element-codec.writeElement"></a>

### wscodec/element-codec.writeElement(writer, innerType, value, [ctx])
Write one element of `innerType` to the writer.

**Kind**: static method of [<code>wscodec/element-codec</code>](#module_wscodec/element-codec)  

| Param | Type | Description |
| --- | --- | --- |
| writer | <code>Writer</code> |  |
| innerType | <code>string</code> | Wire type name. |
| value | <code>\*</code> | Value to encode. |
| [ctx] | <code>Object</code> |  |

<a name="module_wscodec/element-codec.elementToJSON"></a>

### wscodec/element-codec.elementToJSON(value, innerType) ⇒ <code>\*</code>
Convert a decoded element to its JSON-safe form.

**Kind**: static method of [<code>wscodec/element-codec</code>](#module_wscodec/element-codec)  

| Param | Type |
| --- | --- |
| value | <code>\*</code> | 
| innerType | <code>string</code> | 

<a name="module_wscodec/element-codec.elementFromJSON"></a>

### wscodec/element-codec.elementFromJSON(j, innerType) ⇒ <code>\*</code>
Reconstruct an element from its JSON form. Falls through to `OpaqueValue`when the JSON carries the opaque marker.

**Kind**: static method of [<code>wscodec/element-codec</code>](#module_wscodec/element-codec)  

| Param | Type |
| --- | --- |
| j | <code>\*</code> | 
| innerType | <code>string</code> |
