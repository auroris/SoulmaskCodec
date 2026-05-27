# wscodec/property

Source: [`src/property.mjs`](../src/property.mjs)

<a name="module_wscodec/property"></a>

## wscodec/property
Property base class + type-name -> subclass registry.The base implements:- `Property.fromReader(cursor, ctx)`: read a PropertyTag, look up the  subclass for the tag's type, dispatch. Throws on size mismatch (codec  bug: the value reader's consumed bytes != tag's claimed size).- `property.toBytes(writer, ctx)`: encode the value into a sub-buffer so  the actual byte count is known, then emit tag(size) + value.Subclasses implement:- `static fromReader(cursor, tag, sizeHint, ctx)` -> instance- `instance _writeValue(writer, ctx)` (writes only the value bytes)- `instance toJSON()` / `static fromJSON(j)`The registry is populated by the individual property files at moduleload. `blob.mjs` imports them all, so any caller that imports `UnrealBlob`transitively triggers registration.


* [wscodec/property](#module_wscodec/property)
    * [.Property](#module_wscodec/property.Property)
        * [new exports.Property([fields])](#new_module_wscodec/property.Property_new)
        * _instance_
            * [.name](#module_wscodec/property.Property+name) ⇒ <code>string</code> \| <code>null</code>
            * [.type](#module_wscodec/property.Property+type) ⇒ <code>string</code> \| <code>null</code>
            * [.toBytes(writer, [ctx])](#module_wscodec/property.Property+toBytes)
            * [._writeValue(_writer, [_ctx])](#module_wscodec/property.Property+_writeValue)
            * [.toJSON()](#module_wscodec/property.Property+toJSON) ⇒ <code>Object</code>
            * [._writeJSON(_j)](#module_wscodec/property.Property+_writeJSON)
        * _static_
            * [.fromReader(cursor, [ctx])](#module_wscodec/property.Property.fromReader) ⇒ <code>Property</code>
            * [.fromJSON(j)](#module_wscodec/property.Property.fromJSON) ⇒ <code>Property</code>
    * [.TerminatorProperty](#module_wscodec/property.TerminatorProperty)
    * [.PROPERTY_REGISTRY](#module_wscodec/property.PROPERTY_REGISTRY) : <code>Object.&lt;string, function()&gt;</code>
    * [.registerProperty(typeName, cls)](#module_wscodec/property.registerProperty)
    * [.registerOpaqueFallback(cls)](#module_wscodec/property.registerOpaqueFallback)
    * [.getOpaqueFallback()](#module_wscodec/property.getOpaqueFallback) ⇒ <code>function</code> \| <code>undefined</code>
    * [.warnOrThrow(ctx, message)](#module_wscodec/property.warnOrThrow)

<a name="module_wscodec/property.Property"></a>

### wscodec/property.Property
Base class for every decoded property. Carries a `PropertyTag` plus asubclass-specific value; concrete subclasses (`IntProperty`,`ArrayProperty`, `StructProperty`, etc.) live in the `properties/`modules and register themselves via `registerProperty`.

**Kind**: static class of [<code>wscodec/property</code>](#module_wscodec/property)  

* [.Property](#module_wscodec/property.Property)
    * [new exports.Property([fields])](#new_module_wscodec/property.Property_new)
    * _instance_
        * [.name](#module_wscodec/property.Property+name) ⇒ <code>string</code> \| <code>null</code>
        * [.type](#module_wscodec/property.Property+type) ⇒ <code>string</code> \| <code>null</code>
        * [.toBytes(writer, [ctx])](#module_wscodec/property.Property+toBytes)
        * [._writeValue(_writer, [_ctx])](#module_wscodec/property.Property+_writeValue)
        * [.toJSON()](#module_wscodec/property.Property+toJSON) ⇒ <code>Object</code>
        * [._writeJSON(_j)](#module_wscodec/property.Property+_writeJSON)
    * _static_
        * [.fromReader(cursor, [ctx])](#module_wscodec/property.Property.fromReader) ⇒ <code>Property</code>
        * [.fromJSON(j)](#module_wscodec/property.Property.fromJSON) ⇒ <code>Property</code>

<a name="new_module_wscodec/property.Property_new"></a>

#### new exports.Property([fields])

| Param | Type | Description |
| --- | --- | --- |
| [fields] | <code>Object</code> |  |
| [fields.tag] | <code>PropertyTag</code> | The property's header tag. |

<a name="module_wscodec/property.Property+name"></a>

#### property.name ⇒ <code>string</code> \| <code>null</code>
**Kind**: instance property of [<code>Property</code>](#module_wscodec/property.Property)  
**Returns**: <code>string</code> \| <code>null</code> - The property name from the tag.  
<a name="module_wscodec/property.Property+type"></a>

#### property.type ⇒ <code>string</code> \| <code>null</code>
**Kind**: instance property of [<code>Property</code>](#module_wscodec/property.Property)  
**Returns**: <code>string</code> \| <code>null</code> - The property type name from the tag (e.g. `'IntProperty'`).  
<a name="module_wscodec/property.Property+toBytes"></a>

#### property.toBytes(writer, [ctx])
Encode the property to the writer in a single forward pass: emit thetag (with a placeholder size), write the value bytes directly intothe writer, then patch the size field with the actual value bytecount. No sub-buffer allocation, no double-copy.

**Kind**: instance method of [<code>Property</code>](#module_wscodec/property.Property)  

| Param | Type |
| --- | --- |
| writer | <code>Writer</code> | 
| [ctx] | <code>Object</code> | 

<a name="module_wscodec/property.Property+_writeValue"></a>

#### property.\_writeValue(_writer, [_ctx])
Subclass hook: write only the value bytes (the tag is handled by `toBytes`).

**Kind**: instance method of [<code>Property</code>](#module_wscodec/property.Property)  
**Access**: protected  

| Param | Type |
| --- | --- |
| _writer | <code>Writer</code> | 
| [_ctx] | <code>Object</code> | 

<a name="module_wscodec/property.Property+toJSON"></a>

#### property.toJSON() ⇒ <code>Object</code>
Flat JSON form of this property. Combines `tag.toJSON()` with thesubclass's `_writeJSON(j)` hook.

**Kind**: instance method of [<code>Property</code>](#module_wscodec/property.Property)  
<a name="module_wscodec/property.Property+_writeJSON"></a>

#### property.\_writeJSON(_j)
Subclass hook: mutate `j` to add value fields. The tag's fields arealready spread onto `j` by `toJSON`.

**Kind**: instance method of [<code>Property</code>](#module_wscodec/property.Property)  
**Access**: protected  

| Param | Type |
| --- | --- |
| _j | <code>Object</code> | 

<a name="module_wscodec/property.Property.fromReader"></a>

#### Property.fromReader(cursor, [ctx]) ⇒ <code>Property</code>
Read one property: tag + value. Throws on size mismatch (the valuereader consumed a different number of bytes than the tag claimed -that's a codec bug).Returns a `TerminatorProperty` when the tag's Name was "None"; thecaller (typically `PropertyStream.fromReader`) treats that as thestream terminator and does not append it to the result list.

**Kind**: static method of [<code>Property</code>](#module_wscodec/property.Property)  
**Throws**:

- <code>Error</code> On size mismatch or other decode failure.


| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 
| [ctx] | <code>Object</code> | 

<a name="module_wscodec/property.Property.fromJSON"></a>

#### Property.fromJSON(j) ⇒ <code>Property</code>
Reconstruct a Property from its JSON form. Dispatches on `j.type`;unknown types fall through to the opaque fallback.

**Kind**: static method of [<code>Property</code>](#module_wscodec/property.Property)  

| Param | Type |
| --- | --- |
| j | <code>Object</code> | 

<a name="module_wscodec/property.TerminatorProperty"></a>

### wscodec/property.TerminatorProperty
Internal sentinel: signals the end of a property stream. Returned by`Property.fromReader` when the tag's name is "None"; never appended toa PropertyStream's `.properties` list and never produced through JSON.

**Kind**: static class of [<code>wscodec/property</code>](#module_wscodec/property)  
<a name="module_wscodec/property.PROPERTY_REGISTRY"></a>

### wscodec/property.PROPERTY\_REGISTRY : <code>Object.&lt;string, function()&gt;</code>
Type-name -> Property subclass map. Populated as the per-type modulesare imported. Keyed by `tag.type.value` (e.g. `'IntProperty'`,`'ArrayProperty'`); the opaque fallback is stored under a private Symbol.

**Kind**: static constant of [<code>wscodec/property</code>](#module_wscodec/property)  
<a name="module_wscodec/property.registerProperty"></a>

### wscodec/property.registerProperty(typeName, cls)
Register a Property subclass for a wire type name.

**Kind**: static method of [<code>wscodec/property</code>](#module_wscodec/property)  

| Param | Type | Description |
| --- | --- | --- |
| typeName | <code>string</code> | Wire type name (matches `tag.type.value`). |
| cls | <code>function</code> | Subclass to register. |

<a name="module_wscodec/property.registerOpaqueFallback"></a>

### wscodec/property.registerOpaqueFallback(cls)
Register the fallback class used when `tag.type` isn't in the registry.

**Kind**: static method of [<code>wscodec/property</code>](#module_wscodec/property)  

| Param | Type |
| --- | --- |
| cls | <code>function</code> | 

<a name="module_wscodec/property.getOpaqueFallback"></a>

### wscodec/property.getOpaqueFallback() ⇒ <code>function</code> \| <code>undefined</code>
**Kind**: static method of [<code>wscodec/property</code>](#module_wscodec/property)  
**Returns**: <code>function</code> \| <code>undefined</code> - The registered opaque fallback, if any.  
<a name="module_wscodec/property.warnOrThrow"></a>

### wscodec/property.warnOrThrow(ctx, message)
Surface a codec-degradation event (opaque fallback, unknown type, etc.).Default behavior is a `console.warn`; `ctx.strict === true` escalates to athrown Error. Use this at every decode site that would otherwise silentlyround-trip unparsed bytes.

**Kind**: static method of [<code>wscodec/property</code>](#module_wscodec/property)  
**Throws**:

- <code>Error</code> If `ctx.strict` is truthy.


| Param | Type | Description |
| --- | --- | --- |
| ctx | <code>Object</code> \| <code>null</code> \| <code>undefined</code> | Per-call context. Recognized keys: `strict` (boolean). |
| message | <code>string</code> | Human-readable degradation message. |
