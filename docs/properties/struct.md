# wscodec/properties/struct

Source: [`src/properties/struct.mjs`](../src/properties/struct.mjs)

<a name="module_wscodec/properties/struct"></a>

## wscodec/properties/struct
`StructProperty` + `StructValue` + the binary-struct handler registry.A struct on the wire is one of two forms:- `"binary"`     - well-known UE struct (Vector, Quat, FColor, etc.) with  a fixed-layout binary record. Handler reads/writes a plain object  (e.g. `{x, y, z}`) directly.- `"propStream"` - unknown or property-tagged struct: a nested  PropertyStream terminated by None. Always falls through to here when  no handler is registered; ALSO selected for known-binary structs when  the peek heuristic says the next bytes are a PropertyTag (Soulmask  encodes some known-binary structs as tagged streams inside Map struct  values, which would otherwise be misread as raw records).- `"decodeError"` - non-strict-mode fallback when the propStream read  throws mid-decode. Captures the remaining tail bytes as opaque so the  surrounding stream stays aligned.The same `StructValue` class is used both as `StructProperty.value` andas the element type of `ArrayProperty<StructProperty>` / the value sideof `MapProperty<_, StructProperty>`.FColor wire order is B, G, R, A (not R, G, B, A). This matches UE4's`FColor::Serialize`, where the in-memory union exposes the bytes in BGRAorder to match Windows DIB / DirectX texture layout.64-bit integers (DateTime, Timespan) are exchanged as decimal strings;`Writer.writeInt64` accepts string/BigInt/safe-integer-Number.


* [wscodec/properties/struct](#module_wscodec/properties/struct)
    * [.StructValue](#module_wscodec/properties/struct.StructValue)
        * [new exports.StructValue(structName, [fields])](#new_module_wscodec/properties/struct.StructValue_new)
        * _instance_
            * [.isKnownBinary](#module_wscodec/properties/struct.StructValue+isKnownBinary) ⇒ <code>boolean</code>
            * [.toJSON()](#module_wscodec/properties/struct.StructValue+toJSON)
        * _static_
            * [.fromReader(cursor, structName, sizeHint, [ctx], [opts])](#module_wscodec/properties/struct.StructValue.fromReader) ⇒ <code>StructValue</code>
            * [.fromReaderTagged(cursor, structName, [ctx])](#module_wscodec/properties/struct.StructValue.fromReaderTagged) ⇒ <code>StructValue</code>
    * [.StructProperty](#module_wscodec/properties/struct.StructProperty)
        * [new exports.StructProperty([fields])](#new_module_wscodec/properties/struct.StructProperty_new)
    * [.STRUCT_HANDLERS](#module_wscodec/properties/struct.STRUCT_HANDLERS) : <code>Object.&lt;string, {read: function(Cursor): \*, write: function(Writer, \*): void}&gt;</code>
    * [.registerStructHandler(name, handler)](#module_wscodec/properties/struct.registerStructHandler)

<a name="module_wscodec/properties/struct.StructValue"></a>

### wscodec/properties/struct.StructValue
Decoded struct value. The `form` field discriminates between`"binary"`, `"propStream"`, and `"decodeError"`; only the matchingpayload field (`binaryValue` / `stream` / `decodeError` + `opaqueTail`)is populated.

**Kind**: static class of [<code>wscodec/properties/struct</code>](#module_wscodec/properties/struct)  

* [.StructValue](#module_wscodec/properties/struct.StructValue)
    * [new exports.StructValue(structName, [fields])](#new_module_wscodec/properties/struct.StructValue_new)
    * _instance_
        * [.isKnownBinary](#module_wscodec/properties/struct.StructValue+isKnownBinary) ⇒ <code>boolean</code>
        * [.toJSON()](#module_wscodec/properties/struct.StructValue+toJSON)
    * _static_
        * [.fromReader(cursor, structName, sizeHint, [ctx], [opts])](#module_wscodec/properties/struct.StructValue.fromReader) ⇒ <code>StructValue</code>
        * [.fromReaderTagged(cursor, structName, [ctx])](#module_wscodec/properties/struct.StructValue.fromReaderTagged) ⇒ <code>StructValue</code>

<a name="new_module_wscodec/properties/struct.StructValue_new"></a>

#### new exports.StructValue(structName, [fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| structName | <code>string</code> |  | Struct name from the surrounding tag. |
| [fields] | <code>Object</code> |  |  |
| [fields.form] | <code>&#x27;binary&#x27;</code> \| <code>&#x27;propStream&#x27;</code> \| <code>&#x27;decodeError&#x27;</code> \| <code>null</code> | <code></code> |  |
| [fields.binaryValue] | <code>\*</code> | <code></code> | Plain JS value when `form === 'binary'`. |
| [fields.stream] | <code>PropertyStream</code> \| <code>null</code> | <code></code> | Nested stream when `form === 'propStream'`. |
| [fields.decodeError] | <code>string</code> \| <code>null</code> | <code>null</code> | Error message when `form === 'decodeError'`. |
| [fields.opaqueTail] | <code>Uint8Array</code> \| <code>null</code> | <code></code> | Verbatim bytes captured on a `'decodeError'`. |

<a name="module_wscodec/properties/struct.StructValue+isKnownBinary"></a>

#### structValue.isKnownBinary ⇒ <code>boolean</code>
**Kind**: instance property of [<code>StructValue</code>](#module_wscodec/properties/struct.StructValue)  
**Returns**: <code>boolean</code> - True iff a binary handler is registered for this struct name.  
<a name="module_wscodec/properties/struct.StructValue+toJSON"></a>

#### structValue.toJSON()
Write the property-stream BODY only (no None terminator). Used byMap<_, StructProperty> entry values where the surrounding writeremits its own terminator.Currently unused — Map's writer goes through the stream's toByteswhich DOES emit None. Kept for symmetry should we need a no-None form.

**Kind**: instance method of [<code>StructValue</code>](#module_wscodec/properties/struct.StructValue)  
<a name="module_wscodec/properties/struct.StructValue.fromReader"></a>

#### StructValue.fromReader(cursor, structName, sizeHint, [ctx], [opts]) ⇒ <code>StructValue</code>
Read a struct value. `peekTagged` controls whether the peek heuristicis consulted before dispatching to a registered binary handler - usedinside Map<_,Struct> value reads where Soulmask encodes someknown-binary structs as tagged streams.

**Kind**: static method of [<code>StructValue</code>](#module_wscodec/properties/struct.StructValue)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| cursor | <code>Cursor</code> |  |  |
| structName | <code>string</code> |  |  |
| sizeHint | <code>number</code> |  | Byte budget for this value. Pass `Infinity` when the caller has no bound. |
| [ctx] | <code>Object</code> |  |  |
| [opts] | <code>Object</code> |  |  |
| [opts.peekTagged] | <code>boolean</code> | <code>false</code> | If true, consult `peekLooksLikePropertyTag` before using a binary handler. |

<a name="module_wscodec/properties/struct.StructValue.fromReaderTagged"></a>

#### StructValue.fromReaderTagged(cursor, structName, [ctx]) ⇒ <code>StructValue</code>
Read a struct value WITHOUT consulting `STRUCT_HANDLERS` (always usesthe property-stream path). Used by Map<Struct,Struct> entry valuesonce the peek heuristic has decided the bytes are tagged.

**Kind**: static method of [<code>StructValue</code>](#module_wscodec/properties/struct.StructValue)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 
| structName | <code>string</code> | 
| [ctx] | <code>Object</code> | 

<a name="module_wscodec/properties/struct.StructProperty"></a>

### wscodec/properties/struct.StructProperty
Property wrapping a `StructValue`.

**Kind**: static class of [<code>wscodec/properties/struct</code>](#module_wscodec/properties/struct)  
<a name="new_module_wscodec/properties/struct.StructProperty_new"></a>

#### new exports.StructProperty([fields])

| Param | Type | Default |
| --- | --- | --- |
| [fields] | <code>Object</code> |  | 
| [fields.tag] | <code>PropertyTag</code> |  | 
| [fields.value] | <code>StructValue</code> \| <code>null</code> | <code></code> | 

<a name="module_wscodec/properties/struct.STRUCT_HANDLERS"></a>

### wscodec/properties/struct.STRUCT\_HANDLERS : <code>Object.&lt;string, {read: function(Cursor): \*, write: function(Writer, \*): void}&gt;</code>
Wire handlers for well-known UE binary structs. Each entry is a`{ read(cursor), write(writer, value) }` pair.Register or replace entries via `registerStructHandler` rather thanmutating this object directly.

**Kind**: static constant of [<code>wscodec/properties/struct</code>](#module_wscodec/properties/struct)  
<a name="module_wscodec/properties/struct.registerStructHandler"></a>

### wscodec/properties/struct.registerStructHandler(name, handler)
Register (or replace) a struct handler. Use this rather than mutating`STRUCT_HANDLERS` directly; this validates handler shape. Without ahandler, an unknown struct name falls through to the property-streampath.

**Kind**: static method of [<code>wscodec/properties/struct</code>](#module_wscodec/properties/struct)  
**Throws**:

- <code>TypeError</code> If `name` is empty or `handler` is malformed.


| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Struct name as it appears in the property tag (e.g. `"Vector"`). |
| handler | <code>Object</code> | `{ read(cursor), write(writer, value) }`. |
