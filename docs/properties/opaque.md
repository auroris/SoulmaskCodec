# wscodec/properties/opaque

Source: [`src/properties/opaque.mjs`](../src/properties/opaque.mjs)

<a name="module_wscodec/properties/opaque"></a>

## wscodec/properties/opaque
Opaque fallback for content the codec couldn't (or wouldn't) decode.- `OpaqueProperty` - the entire property; used when `tag.type` is  unrecognized or when a top-level value decode fails.- `OpaqueValue` - a sub-value inside a container (array element, map  value, struct field, text body) whose own decode failed while the  surrounding shape stayed intact.Both are plain byte-carrying containers. The decode-site policy (warn,or throw under `{ strict: true }`) is enforced by `warnOrThrow` in`property.mjs` at the moment the codec degrades - these classes don'twarn or throw on construction. That keeps JSON reconstruction silent(the user already opted in by writing them to JSON in the first place).


* [wscodec/properties/opaque](#module_wscodec/properties/opaque)
    * [.OpaqueValue](#module_wscodec/properties/opaque.OpaqueValue)
        * [new exports.OpaqueValue([fields])](#new_module_wscodec/properties/opaque.OpaqueValue_new)
        * _instance_
            * [.toBytes(writer)](#module_wscodec/properties/opaque.OpaqueValue+toBytes)
            * [.toJSON()](#module_wscodec/properties/opaque.OpaqueValue+toJSON) ⇒ <code>Object</code>
        * _static_
            * [.fromReader(cursor, sizeHint, [reason])](#module_wscodec/properties/opaque.OpaqueValue.fromReader) ⇒ <code>OpaqueValue</code>
            * [.fromJSON(j)](#module_wscodec/properties/opaque.OpaqueValue.fromJSON) ⇒ <code>OpaqueValue</code>
            * [.isOpaqueJSON(j)](#module_wscodec/properties/opaque.OpaqueValue.isOpaqueJSON) ⇒ <code>boolean</code>
    * [.OpaqueProperty](#module_wscodec/properties/opaque.OpaqueProperty)
        * [new exports.OpaqueProperty([fields])](#new_module_wscodec/properties/opaque.OpaqueProperty_new)
        * [.fromReader(cursor, tag, sizeHint, [ctx])](#module_wscodec/properties/opaque.OpaqueProperty.fromReader) ⇒ <code>OpaqueProperty</code>

<a name="module_wscodec/properties/opaque.OpaqueValue"></a>

### wscodec/properties/opaque.OpaqueValue
Byte-carrying sub-value used when a container element fails to decode.

**Kind**: static class of [<code>wscodec/properties/opaque</code>](#module_wscodec/properties/opaque)  

* [.OpaqueValue](#module_wscodec/properties/opaque.OpaqueValue)
    * [new exports.OpaqueValue([fields])](#new_module_wscodec/properties/opaque.OpaqueValue_new)
    * _instance_
        * [.toBytes(writer)](#module_wscodec/properties/opaque.OpaqueValue+toBytes)
        * [.toJSON()](#module_wscodec/properties/opaque.OpaqueValue+toJSON) ⇒ <code>Object</code>
    * _static_
        * [.fromReader(cursor, sizeHint, [reason])](#module_wscodec/properties/opaque.OpaqueValue.fromReader) ⇒ <code>OpaqueValue</code>
        * [.fromJSON(j)](#module_wscodec/properties/opaque.OpaqueValue.fromJSON) ⇒ <code>OpaqueValue</code>
        * [.isOpaqueJSON(j)](#module_wscodec/properties/opaque.OpaqueValue.isOpaqueJSON) ⇒ <code>boolean</code>

<a name="new_module_wscodec/properties/opaque.OpaqueValue_new"></a>

#### new exports.OpaqueValue([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.bytes] | <code>Uint8Array</code> |  | Captured raw bytes. |
| [fields.reason] | <code>string</code> \| <code>null</code> | <code>null</code> | Human-readable description of why decoding failed. |

<a name="module_wscodec/properties/opaque.OpaqueValue+toBytes"></a>

#### opaqueValue.toBytes(writer)
**Kind**: instance method of [<code>OpaqueValue</code>](#module_wscodec/properties/opaque.OpaqueValue)  

| Param | Type |
| --- | --- |
| writer | <code>Writer</code> | 

<a name="module_wscodec/properties/opaque.OpaqueValue+toJSON"></a>

#### opaqueValue.toJSON() ⇒ <code>Object</code>
**Kind**: instance method of [<code>OpaqueValue</code>](#module_wscodec/properties/opaque.OpaqueValue)  
<a name="module_wscodec/properties/opaque.OpaqueValue.fromReader"></a>

#### OpaqueValue.fromReader(cursor, sizeHint, [reason]) ⇒ <code>OpaqueValue</code>
Capture `sizeHint` bytes from `cursor` as opaque. The caller isresponsible for calling `warnOrThrow(ctx, ...)` first; this constructoris just bytes-in, bytes-out.

**Kind**: static method of [<code>OpaqueValue</code>](#module_wscodec/properties/opaque.OpaqueValue)  

| Param | Type | Description |
| --- | --- | --- |
| cursor | <code>Cursor</code> |  |
| sizeHint | <code>number</code> | Number of bytes to capture. |
| [reason] | <code>string</code> \| <code>null</code> | Human-readable explanation. |

<a name="module_wscodec/properties/opaque.OpaqueValue.fromJSON"></a>

#### OpaqueValue.fromJSON(j) ⇒ <code>OpaqueValue</code>
**Kind**: static method of [<code>OpaqueValue</code>](#module_wscodec/properties/opaque.OpaqueValue)  

| Param | Type |
| --- | --- |
| j | <code>Object</code> | 

<a name="module_wscodec/properties/opaque.OpaqueValue.isOpaqueJSON"></a>

#### OpaqueValue.isOpaqueJSON(j) ⇒ <code>boolean</code>
**Kind**: static method of [<code>OpaqueValue</code>](#module_wscodec/properties/opaque.OpaqueValue)  
**Returns**: <code>boolean</code> - True iff `j` is an `OpaqueValue` JSON record.  

| Param | Type |
| --- | --- |
| j | <code>\*</code> | 

<a name="module_wscodec/properties/opaque.OpaqueProperty"></a>

### wscodec/properties/opaque.OpaqueProperty
Byte-carrying property used as the registry's fallback for unknown`tag.type` values or top-level decode failures.

**Kind**: static class of [<code>wscodec/properties/opaque</code>](#module_wscodec/properties/opaque)  

* [.OpaqueProperty](#module_wscodec/properties/opaque.OpaqueProperty)
    * [new exports.OpaqueProperty([fields])](#new_module_wscodec/properties/opaque.OpaqueProperty_new)
    * [.fromReader(cursor, tag, sizeHint, [ctx])](#module_wscodec/properties/opaque.OpaqueProperty.fromReader) ⇒ <code>OpaqueProperty</code>

<a name="new_module_wscodec/properties/opaque.OpaqueProperty_new"></a>

#### new exports.OpaqueProperty([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.tag] | <code>PropertyTag</code> |  |  |
| [fields.bytes] | <code>Uint8Array</code> |  | Captured raw value bytes. |
| [fields.reason] | <code>string</code> \| <code>null</code> | <code>null</code> |  |

<a name="module_wscodec/properties/opaque.OpaqueProperty.fromReader"></a>

#### OpaqueProperty.fromReader(cursor, tag, sizeHint, [ctx]) ⇒ <code>OpaqueProperty</code>
Called by `Property.fromReader` as the fallback when `tag.type.value`isn't in the registry - captures the value bytes verbatim and emitsa structured warn (or throws under strict mode).

**Kind**: static method of [<code>OpaqueProperty</code>](#module_wscodec/properties/opaque.OpaqueProperty)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 
| tag | <code>PropertyTag</code> | 
| sizeHint | <code>number</code> | 
| [ctx] | <code>Object</code> |
