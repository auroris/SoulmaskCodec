# wscodec/properties/soft-object

Source: [`src/properties/soft-object.mjs`](../src/properties/soft-object.mjs)

<a name="module_wscodec/properties/soft-object"></a>

## wscodec/properties/soft-object
`SoftObjectProperty` / `SoftClassProperty`.Wire shape: two consecutive FStrings - `assetPath`, then `subPath`. Emptysub-paths are common; non-empty entries point inside a level / sublevel.`SoftObjectRef` is the value type. It's a class (not a plain`{assetPath, subPath}` object) for symmetry with `ObjectRef` and so futureextension (e.g. caching the parsed asset path) has somewhere to live.


* [wscodec/properties/soft-object](#module_wscodec/properties/soft-object)
    * [.SoftObjectRef](#module_wscodec/properties/soft-object.SoftObjectRef)
        * [new exports.SoftObjectRef([fields])](#new_module_wscodec/properties/soft-object.SoftObjectRef_new)
        * _instance_
            * [.toBytes(writer)](#module_wscodec/properties/soft-object.SoftObjectRef+toBytes)
            * [.toJSON()](#module_wscodec/properties/soft-object.SoftObjectRef+toJSON) ⇒ <code>Object</code>
        * _static_
            * [.fromReader(cursor)](#module_wscodec/properties/soft-object.SoftObjectRef.fromReader) ⇒ <code>SoftObjectRef</code>
            * [.fromJSON(j)](#module_wscodec/properties/soft-object.SoftObjectRef.fromJSON) ⇒ <code>SoftObjectRef</code>
    * [.SoftObjectProperty](#module_wscodec/properties/soft-object.SoftObjectProperty)
        * [new exports.SoftObjectProperty([fields])](#new_module_wscodec/properties/soft-object.SoftObjectProperty_new)
    * [.SoftClassProperty](#module_wscodec/properties/soft-object.SoftClassProperty)

<a name="module_wscodec/properties/soft-object.SoftObjectRef"></a>

### wscodec/properties/soft-object.SoftObjectRef
Decoded `SoftObjectProperty` value: a pair of FStrings naming an assetand an optional sub-path inside that asset.

**Kind**: static class of [<code>wscodec/properties/soft-object</code>](#module_wscodec/properties/soft-object)  

* [.SoftObjectRef](#module_wscodec/properties/soft-object.SoftObjectRef)
    * [new exports.SoftObjectRef([fields])](#new_module_wscodec/properties/soft-object.SoftObjectRef_new)
    * _instance_
        * [.toBytes(writer)](#module_wscodec/properties/soft-object.SoftObjectRef+toBytes)
        * [.toJSON()](#module_wscodec/properties/soft-object.SoftObjectRef+toJSON) ⇒ <code>Object</code>
    * _static_
        * [.fromReader(cursor)](#module_wscodec/properties/soft-object.SoftObjectRef.fromReader) ⇒ <code>SoftObjectRef</code>
        * [.fromJSON(j)](#module_wscodec/properties/soft-object.SoftObjectRef.fromJSON) ⇒ <code>SoftObjectRef</code>

<a name="new_module_wscodec/properties/soft-object.SoftObjectRef_new"></a>

#### new exports.SoftObjectRef([fields])

| Param | Type | Default |
| --- | --- | --- |
| [fields] | <code>Object</code> |  | 
| [fields.assetPath] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | 
| [fields.subPath] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | 

<a name="module_wscodec/properties/soft-object.SoftObjectRef+toBytes"></a>

#### softObjectRef.toBytes(writer)
**Kind**: instance method of [<code>SoftObjectRef</code>](#module_wscodec/properties/soft-object.SoftObjectRef)  

| Param | Type |
| --- | --- |
| writer | <code>Writer</code> | 

<a name="module_wscodec/properties/soft-object.SoftObjectRef+toJSON"></a>

#### softObjectRef.toJSON() ⇒ <code>Object</code>
**Kind**: instance method of [<code>SoftObjectRef</code>](#module_wscodec/properties/soft-object.SoftObjectRef)  
<a name="module_wscodec/properties/soft-object.SoftObjectRef.fromReader"></a>

#### SoftObjectRef.fromReader(cursor) ⇒ <code>SoftObjectRef</code>
**Kind**: static method of [<code>SoftObjectRef</code>](#module_wscodec/properties/soft-object.SoftObjectRef)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 

<a name="module_wscodec/properties/soft-object.SoftObjectRef.fromJSON"></a>

#### SoftObjectRef.fromJSON(j) ⇒ <code>SoftObjectRef</code>
**Kind**: static method of [<code>SoftObjectRef</code>](#module_wscodec/properties/soft-object.SoftObjectRef)  

| Param | Type |
| --- | --- |
| j | <code>Object</code> | 

<a name="module_wscodec/properties/soft-object.SoftObjectProperty"></a>

### wscodec/properties/soft-object.SoftObjectProperty
Property wrapping a `SoftObjectRef`.

**Kind**: static class of [<code>wscodec/properties/soft-object</code>](#module_wscodec/properties/soft-object)  
<a name="new_module_wscodec/properties/soft-object.SoftObjectProperty_new"></a>

#### new exports.SoftObjectProperty([fields])

| Param | Type | Default |
| --- | --- | --- |
| [fields] | <code>Object</code> |  | 
| [fields.tag] | <code>PropertyTag</code> |  | 
| [fields.value] | <code>SoftObjectRef</code> \| <code>null</code> | <code></code> | 

<a name="module_wscodec/properties/soft-object.SoftClassProperty"></a>

### wscodec/properties/soft-object.SoftClassProperty
Same wire layout as `SoftObjectProperty` (UE just uses a differentdeclared type in the tag). Subclass for `tag.type` symmetry.

**Kind**: static class of [<code>wscodec/properties/soft-object</code>](#module_wscodec/properties/soft-object)
