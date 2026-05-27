# wscodec/blob

Source: [`src/blob.mjs`](../src/blob.mjs)

<a name="module_wscodec/blob"></a>

## wscodec/blob
UnrealBlob: top-level entry point for the wscodec.  UnrealBlob.fromBytes(u8, opts)   -> parse uncompressed property-stream bytes  blob.toBytes()                   -> re-encode to bytes  UnrealBlob.fromJSON(j)           -> reconstruct from a structured JSON tree  blob.toJSON()                    -> produce a JSON-safe tree  UnrealBlob.fromJSONString(s)     -> parse + reconstruct from a JSON string                                     (handles -0 / NaN / Infinity via sentinels)  blob.toJSONString(indent)        -> stringify with sentinel substitutionWire layout (bytes accepted by `fromBytes` and produced by `toBytes`):  [0..3]   u32 LE   versionTag = 0x00000002  [4..]    FPropertyTag stream terminated by "None" + int32 0 trailerSoulmask actor_data envelope (handled OUTSIDE this library):  [0..3]   u32 LE       outer version tag = 0x00000002  [4..]    LZ4 block    size-prefixed; decompresses to the bytes above.The SQLite `actor_table.data_version` column stores the NEGATIVE of thewire-format DataVersion. A healthy blob with DataVersion=2 lives in a rowwhose `data_version` column reads -2. The wire bytes themselves are alwaysthe unsigned 0x00000002; the negation is purely a column-side convention.`fromBytes` accepts an `opts.strict` flag. When true, every opaquefallback (unknown property type, decode failure inside a container,unimplemented FText historyType, delegate property family) throwsinstead of warning + capturing bytes. Default behavior is to warn via`console.warn` and keep going.


* [wscodec/blob](#module_wscodec/blob)
    * [.UnrealBlob](#module_wscodec/blob.UnrealBlob)
        * [new exports.UnrealBlob([fields])](#new_module_wscodec/blob.UnrealBlob_new)
        * _instance_
            * [.kind](#module_wscodec/blob.UnrealBlob+kind) ⇒ <code>string</code>
            * [.properties](#module_wscodec/blob.UnrealBlob+properties) ⇒ <code>Array.&lt;Property&gt;</code>
            * [.terminated](#module_wscodec/blob.UnrealBlob+terminated) ⇒ <code>boolean</code>
            * [.findProperty(propName)](#module_wscodec/blob.UnrealBlob+findProperty) ⇒ <code>Property</code> \| <code>null</code>
            * [.findPropertyDeep(propName)](#module_wscodec/blob.UnrealBlob+findPropertyDeep) ⇒ <code>Property</code> \| <code>null</code>
            * [.toBytes()](#module_wscodec/blob.UnrealBlob+toBytes) ⇒ <code>Uint8Array</code>
            * [.toJSON()](#module_wscodec/blob.UnrealBlob+toJSON) ⇒ <code>Object</code>
            * [.toJSONString([indent])](#module_wscodec/blob.UnrealBlob+toJSONString) ⇒ <code>string</code>
        * _static_
            * [.detect(u8)](#module_wscodec/blob.UnrealBlob.detect) ⇒ <code>boolean</code>
            * [.fromBytes(u8, [opts])](#module_wscodec/blob.UnrealBlob.fromBytes) ⇒ <code>UnrealBlob</code>
            * [.fromJSON(j)](#module_wscodec/blob.UnrealBlob.fromJSON) ⇒ <code>UnrealBlob</code>
            * [.fromJSONString(s)](#module_wscodec/blob.UnrealBlob.fromJSONString) ⇒ <code>UnrealBlob</code>
    * [.VERSION_TAG](#module_wscodec/blob.VERSION_TAG) : <code>number</code>
    * [.codec](#module_wscodec/blob.codec) : <code>Object</code>
    * [.jsonReplacer(_key, value)](#module_wscodec/blob.jsonReplacer) ⇒ <code>\*</code>
    * [.jsonReviver(_key, value)](#module_wscodec/blob.jsonReviver) ⇒ <code>\*</code>

<a name="module_wscodec/blob.UnrealBlob"></a>

### wscodec/blob.UnrealBlob
Top-level container for a decoded property stream. Use `UnrealBlob.fromBytes`to parse uncompressed bytes and `blob.toBytes()` to re-encode.

**Kind**: static class of [<code>wscodec/blob</code>](#module_wscodec/blob)  

* [.UnrealBlob](#module_wscodec/blob.UnrealBlob)
    * [new exports.UnrealBlob([fields])](#new_module_wscodec/blob.UnrealBlob_new)
    * _instance_
        * [.kind](#module_wscodec/blob.UnrealBlob+kind) ⇒ <code>string</code>
        * [.properties](#module_wscodec/blob.UnrealBlob+properties) ⇒ <code>Array.&lt;Property&gt;</code>
        * [.terminated](#module_wscodec/blob.UnrealBlob+terminated) ⇒ <code>boolean</code>
        * [.findProperty(propName)](#module_wscodec/blob.UnrealBlob+findProperty) ⇒ <code>Property</code> \| <code>null</code>
        * [.findPropertyDeep(propName)](#module_wscodec/blob.UnrealBlob+findPropertyDeep) ⇒ <code>Property</code> \| <code>null</code>
        * [.toBytes()](#module_wscodec/blob.UnrealBlob+toBytes) ⇒ <code>Uint8Array</code>
        * [.toJSON()](#module_wscodec/blob.UnrealBlob+toJSON) ⇒ <code>Object</code>
        * [.toJSONString([indent])](#module_wscodec/blob.UnrealBlob+toJSONString) ⇒ <code>string</code>
    * _static_
        * [.detect(u8)](#module_wscodec/blob.UnrealBlob.detect) ⇒ <code>boolean</code>
        * [.fromBytes(u8, [opts])](#module_wscodec/blob.UnrealBlob.fromBytes) ⇒ <code>UnrealBlob</code>
        * [.fromJSON(j)](#module_wscodec/blob.UnrealBlob.fromJSON) ⇒ <code>UnrealBlob</code>
        * [.fromJSONString(s)](#module_wscodec/blob.UnrealBlob.fromJSONString) ⇒ <code>UnrealBlob</code>

<a name="new_module_wscodec/blob.UnrealBlob_new"></a>

#### new exports.UnrealBlob([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.versionTag] | <code>number</code> | <code>VERSION_TAG</code> | 4-byte wire header value. |
| [fields.stream] | <code>PropertyStream</code> |  | Decoded property stream (defaults to empty). |
| [fields.bodyTrailing] | <code>Uint8Array</code> \| <code>null</code> | <code></code> | Any unconsumed bytes after the stream terminator. Preserved verbatim. |

<a name="module_wscodec/blob.UnrealBlob+kind"></a>

#### unrealBlob.kind ⇒ <code>string</code>
Codec-adapter name. Matches the `name` field on the bare `codec` export.

**Kind**: instance property of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  
**Returns**: <code>string</code> - The constant `'unreal-properties'`.  
<a name="module_wscodec/blob.UnrealBlob+properties"></a>

#### unrealBlob.properties ⇒ <code>Array.&lt;Property&gt;</code>
Convenience accessor for the top-level property list. Equivalent to`this.stream.properties` - exposes the canonical place to add/removeproperties at the top level.

**Kind**: instance property of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  
**Returns**: <code>Array.&lt;Property&gt;</code> - Top-level properties.  
<a name="module_wscodec/blob.UnrealBlob+terminated"></a>

#### unrealBlob.terminated ⇒ <code>boolean</code>
True iff the property stream was successfully terminated by a None tag.

**Kind**: instance property of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  
<a name="module_wscodec/blob.UnrealBlob+findProperty"></a>

#### unrealBlob.findProperty(propName) ⇒ <code>Property</code> \| <code>null</code>
First TOP-LEVEL property with the given tag name, or null. Does NOTtraverse into embedded streams, struct values, array elements, or mapentries - use `findPropertyDeep` for that.

**Kind**: instance method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  
**Returns**: <code>Property</code> \| <code>null</code> - Match or null.  

| Param | Type | Description |
| --- | --- | --- |
| propName | <code>string</code> | Tag name to search for. |

<a name="module_wscodec/blob.UnrealBlob+findPropertyDeep"></a>

#### unrealBlob.findPropertyDeep(propName) ⇒ <code>Property</code> \| <code>null</code>
Depth-first search for the first property with the given tag name,anywhere in the tree. Walks:- top-level properties- ObjectRef.embedded (PropertyStream)- StructValue's propStream form- ArrayProperty / SetProperty StructValue elements + ObjectRef embeddeds- MapProperty entries: both key (when StructValue) and value

**Kind**: instance method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  
**Returns**: <code>Property</code> \| <code>null</code> - Match or null.  

| Param | Type | Description |
| --- | --- | --- |
| propName | <code>string</code> | Tag name to search for. |

<a name="module_wscodec/blob.UnrealBlob+toBytes"></a>

#### unrealBlob.toBytes() ⇒ <code>Uint8Array</code>
Re-encode this blob to bytes. Always recomputes every tag size fromactually-encoded value bytes; there is no pass-through path.

**Kind**: instance method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  
**Returns**: <code>Uint8Array</code> - The encoded blob.  
<a name="module_wscodec/blob.UnrealBlob+toJSON"></a>

#### unrealBlob.toJSON() ⇒ <code>Object</code>
Produce a JSON-safe tree representation. Bytes (e.g. `bodyTrailing`)are base64-encoded; non-finite numbers must additionally be guardedwith `jsonReplacer` at stringify time.

**Kind**: instance method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  
**Returns**: <code>Object</code> - JSON tree.  
<a name="module_wscodec/blob.UnrealBlob+toJSONString"></a>

#### unrealBlob.toJSONString([indent]) ⇒ <code>string</code>
Stringify with -0 / NaN / Infinity preserved via sentinel substitution.

**Kind**: instance method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  

| Param | Type | Description |
| --- | --- | --- |
| [indent] | <code>number</code> \| <code>string</code> | Forwarded to `JSON.stringify`. |

<a name="module_wscodec/blob.UnrealBlob.detect"></a>

#### UnrealBlob.detect(u8) ⇒ <code>boolean</code>
True iff `u8` starts with the wscodec wire header. Cheap header sniff;doesn't validate the rest of the structure.

**Kind**: static method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  

| Param | Type | Description |
| --- | --- | --- |
| u8 | <code>Uint8Array</code> | Bytes to test. |

<a name="module_wscodec/blob.UnrealBlob.fromBytes"></a>

#### UnrealBlob.fromBytes(u8, [opts]) ⇒ <code>UnrealBlob</code>
Parse uncompressed property-stream bytes. Always throws on sizemismatch (codec bug) or any other structural failure; the`opts.strict` flag additionally escalates every opaque-fallback site(unknown property type, FText unknown historyType, etc.) into a thrownError rather than a warn-and-capture.

**Kind**: static method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  
**Throws**:

- <code>Error</code> If the header is wrong, the structure is invalid, or strict mode trips on an unknown shape.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| u8 | <code>Uint8Array</code> |  | Uncompressed property-stream bytes. |
| [opts] | <code>Object</code> |  |  |
| [opts.strict] | <code>boolean</code> | <code>false</code> | Escalate opaque fallbacks into thrown errors. |

<a name="module_wscodec/blob.UnrealBlob.fromJSON"></a>

#### UnrealBlob.fromJSON(j) ⇒ <code>UnrealBlob</code>
Reconstruct a blob from a JSON tree produced by `toJSON`.

**Kind**: static method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  

| Param | Type | Description |
| --- | --- | --- |
| j | <code>Object</code> | JSON tree. |

<a name="module_wscodec/blob.UnrealBlob.fromJSONString"></a>

#### UnrealBlob.fromJSONString(s) ⇒ <code>UnrealBlob</code>
Parse + reconstruct, undoing the sentinel substitution.

**Kind**: static method of [<code>UnrealBlob</code>](#module_wscodec/blob.UnrealBlob)  

| Param | Type | Description |
| --- | --- | --- |
| s | <code>string</code> | JSON string produced by `toJSONString`. |

<a name="module_wscodec/blob.VERSION_TAG"></a>

### wscodec/blob.VERSION\_TAG : <code>number</code>
Wire format DataVersion. Always the first 4 bytes (little-endian) of anuncompressed blob.

**Kind**: static constant of [<code>wscodec/blob</code>](#module_wscodec/blob)  
<a name="module_wscodec/blob.codec"></a>

### wscodec/blob.codec : <code>Object</code>
Codec-adapter shape (`{ name, detect, decode, encode }`). Suitable forplugging into a registry that dispatches codecs by `name`. Operates onthe uncompressed bytes that `UnrealBlob.fromBytes` accepts; callersreading Soulmask's `actor_data` column directly wrap this with thecolumn's outer LZ4 envelope.

**Kind**: static constant of [<code>wscodec/blob</code>](#module_wscodec/blob)  
<a name="module_wscodec/blob.jsonReplacer"></a>

### wscodec/blob.jsonReplacer(_key, value) ⇒ <code>\*</code>
`JSON.stringify` replacer that substitutes sentinels for -0 / Infinity /NaN. Pass this to any `JSON.stringify` call that may containwscodec-derived numbers (including a blob nested inside a largerenvelope). Use `jsonReviver` on the matching `JSON.parse` to invert.

**Kind**: static method of [<code>wscodec/blob</code>](#module_wscodec/blob)  
**Returns**: <code>\*</code> - Sentinel string for -0/Infinity/NaN, otherwise the value unchanged.  

| Param | Type | Description |
| --- | --- | --- |
| _key | <code>string</code> | Property key (unused). |
| value | <code>\*</code> | Value being serialized. |

<a name="module_wscodec/blob.jsonReviver"></a>

### wscodec/blob.jsonReviver(_key, value) ⇒ <code>\*</code>
Inverse of `jsonReplacer`. Pass to `JSON.parse(text, jsonReviver)`.

**Kind**: static method of [<code>wscodec/blob</code>](#module_wscodec/blob)  
**Returns**: <code>\*</code> - -0/Infinity/NaN when the value is a known sentinel, otherwise unchanged.  

| Param | Type | Description |
| --- | --- | --- |
| _key | <code>string</code> | Property key (unused). |
| value | <code>\*</code> | Value being revived. |
