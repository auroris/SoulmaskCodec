# wscodec/tag

Source: [`src/tag.mjs`](../src/tag.mjs)

<a name="module_wscodec/tag"></a>

## wscodec/tag
PropertyTag: the header preceding each property's value bytes.Wire layout (UE 4.27, FPropertyTag.h, Soulmask tweaks):  FString  Name  [if Name == "None": stream terminator; no further fields]  FString  Type  int32    Size                  // bytes of value data following the tag  int32    ArrayIndex  // type-specific tag data (see TAG_EXTRAS):  if Type == "StructProperty":  FString StructName + FGuid StructGuid  if Type == "BoolProperty":    u8 BoolVal  if Type == "ByteProperty":    FString EnumName  if Type == "EnumProperty":    FString EnumName  if Type == "ArrayProperty":   FString InnerType  if Type == "SetProperty":     FString InnerType  if Type == "MapProperty":     FString InnerType + FString ValueType  u8       HasPropertyGuid  if HasPropertyGuid:           FGuid PropertyGuid


* [wscodec/tag](#module_wscodec/tag)
    * [.PropertyTag](#module_wscodec/tag.PropertyTag)
        * [new exports.PropertyTag([fields])](#new_module_wscodec/tag.PropertyTag_new)
        * _instance_
            * [.toBytes(writer)](#module_wscodec/tag.PropertyTag+toBytes) ⇒ <code>number</code>
            * [.toJSON()](#module_wscodec/tag.PropertyTag+toJSON) ⇒ <code>Object</code>
        * _static_
            * [.fromReader(cursor)](#module_wscodec/tag.PropertyTag.fromReader) ⇒ <code>PropertyTag</code>
            * [.fromJSON(j)](#module_wscodec/tag.PropertyTag.fromJSON) ⇒ <code>PropertyTag</code>

<a name="module_wscodec/tag.PropertyTag"></a>

### wscodec/tag.PropertyTag
The header that precedes each property's value bytes. Carries theproperty's name, type, size, array index, and any per-type extras(struct name/guid, enum name, inner/value types, optional property guid).Also represents the stream terminator: when the wire name is `"None"`,`isTerminator` is true and the rest of the fields are unused.

**Kind**: static class of [<code>wscodec/tag</code>](#module_wscodec/tag)  

* [.PropertyTag](#module_wscodec/tag.PropertyTag)
    * [new exports.PropertyTag([fields])](#new_module_wscodec/tag.PropertyTag_new)
    * _instance_
        * [.toBytes(writer)](#module_wscodec/tag.PropertyTag+toBytes) ⇒ <code>number</code>
        * [.toJSON()](#module_wscodec/tag.PropertyTag+toJSON) ⇒ <code>Object</code>
    * _static_
        * [.fromReader(cursor)](#module_wscodec/tag.PropertyTag.fromReader) ⇒ <code>PropertyTag</code>
        * [.fromJSON(j)](#module_wscodec/tag.PropertyTag.fromJSON) ⇒ <code>PropertyTag</code>

<a name="new_module_wscodec/tag.PropertyTag_new"></a>

#### new exports.PropertyTag([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.name] | <code>FName</code> \| <code>null</code> | <code></code> |  |
| [fields.type] | <code>FName</code> \| <code>null</code> | <code></code> |  |
| [fields.arrayIndex] | <code>number</code> | <code>0</code> |  |
| [fields.structName] | <code>FName</code> \| <code>null</code> | <code></code> | StructProperty only. |
| [fields.structGuid] | <code>FGuid</code> \| <code>null</code> | <code></code> | StructProperty only. |
| [fields.boolVal] | <code>number</code> \| <code>null</code> | <code></code> | BoolProperty only. |
| [fields.enumName] | <code>FName</code> \| <code>null</code> | <code></code> | ByteProperty/EnumProperty only. |
| [fields.innerType] | <code>FName</code> \| <code>null</code> | <code></code> | Array/Set/Map element type. |
| [fields.valueType] | <code>FName</code> \| <code>null</code> | <code></code> | Map value type. |
| [fields.hasPropertyGuid] | <code>boolean</code> | <code>false</code> |  |
| [fields.propertyGuid] | <code>FGuid</code> \| <code>null</code> | <code></code> |  |
| [fields.isTerminator] | <code>boolean</code> | <code>false</code> | True iff this tag represents the stream terminator. |

<a name="module_wscodec/tag.PropertyTag+toBytes"></a>

#### propertyTag.toBytes(writer) ⇒ <code>number</code>
Emit the tag bytes with a zero placeholder for the `size` field, andreturn the absolute writer offset of that placeholder so the callercan patch it once the value bytes have been written. This lets usencode a property in a single forward pass - no sub-buffering of thevalue just to measure its size.Terminator tags have no size field and no further payload; thisreturns -1 so the caller can branch (though in practice terminatortags are emitted directly via `new FName('None').toBytes(writer)` anddon't pass through this method).

**Kind**: instance method of [<code>PropertyTag</code>](#module_wscodec/tag.PropertyTag)  
**Returns**: <code>number</code> - Absolute writer position of the size placeholder, or -1 for a terminator tag.  

| Param | Type |
| --- | --- |
| writer | <code>Writer</code> | 

<a name="module_wscodec/tag.PropertyTag+toJSON"></a>

#### propertyTag.toJSON() ⇒ <code>Object</code>
Flat JSON form of the tag. Spread into the surrounding property's JSONby `Property.toJSON`.

**Kind**: instance method of [<code>PropertyTag</code>](#module_wscodec/tag.PropertyTag)  
<a name="module_wscodec/tag.PropertyTag.fromReader"></a>

#### PropertyTag.fromReader(cursor) ⇒ <code>PropertyTag</code>
Read a PropertyTag from the cursor. The wire `size` field is capturedin `tag._readSize` (transient - used by Property.fromReader as thevalue-decoding byte budget, then discarded).

**Kind**: static method of [<code>PropertyTag</code>](#module_wscodec/tag.PropertyTag)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 

<a name="module_wscodec/tag.PropertyTag.fromJSON"></a>

#### PropertyTag.fromJSON(j) ⇒ <code>PropertyTag</code>
Reconstruct a PropertyTag from its JSON form.

**Kind**: static method of [<code>PropertyTag</code>](#module_wscodec/tag.PropertyTag)  

| Param | Type |
| --- | --- |
| j | <code>Object</code> |
