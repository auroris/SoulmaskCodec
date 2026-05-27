# wscodec/properties/object

Source: [`src/properties/object.mjs`](../src/properties/object.mjs)

<a name="module_wscodec/properties/object"></a>

## wscodec/properties/object
`ObjectProperty` (and its aliases) + the `ObjectRef` value class.Aliased property tags that all wrap an `ObjectRef`: `ObjectProperty`,`ClassProperty`, `WeakObjectProperty`, `LazyObjectProperty`,`WSObjectProperty` (Soulmask alias).Soulmask's ObjectProperty wire shape is variable; the reader uses thetag's size budget to decide which of these shapes is on the wire:  u8       kind             always present  u32      kindOnePrefix    ONLY when kind === 0x01 (Soulmask). The                            observed value is always 1; semantic unknown.                            Captured verbatim and replayed. Seen on hard                            actor references like NPC `HBindBGCompActor`                            (pawn -> inventory link).  FString  path             present iff budget remains  FString  classPath        present iff budget remains  stream   embedded         present iff budget remains; terminated by None,                            optionally followed by a 4-byte FName.Number                            trailer for certain Soulmask embeddeds                            (e.g. JianZhuInstGLQComponent)`null` for `path` / `classPath` means the field was NOT on the wire (sothe writer skips it). An empty string with the corresponding `isNull`flag preserves the wire distinction between FString null-form (SaveNum=0,4 B) and empty-with-terminator (SaveNum=1, 5 B).


* [wscodec/properties/object](#module_wscodec/properties/object)
    * [.ObjectRef](#module_wscodec/properties/object.ObjectRef)
        * [new exports.ObjectRef([fields])](#new_module_wscodec/properties/object.ObjectRef_new)
        * _instance_
            * [.hasEmbedded](#module_wscodec/properties/object.ObjectRef+hasEmbedded) ⇒ <code>boolean</code>
            * [.toBytes(writer, [opts])](#module_wscodec/properties/object.ObjectRef+toBytes)
        * _static_
            * [.fromReaderTopLevel(cursor, sizeHint, [ctx])](#module_wscodec/properties/object.ObjectRef.fromReaderTopLevel) ⇒ <code>ObjectRef</code>
            * [.fromReaderArrayElement(cursor, sizeHint, [ctx])](#module_wscodec/properties/object.ObjectRef.fromReaderArrayElement) ⇒ <code>ObjectRef</code>
    * [.ObjectProperty](#module_wscodec/properties/object.ObjectProperty)
        * [new exports.ObjectProperty([fields])](#new_module_wscodec/properties/object.ObjectProperty_new)
    * [.ClassProperty](#module_wscodec/properties/object.ClassProperty)
    * [.WeakObjectProperty](#module_wscodec/properties/object.WeakObjectProperty)
    * [.LazyObjectProperty](#module_wscodec/properties/object.LazyObjectProperty)
    * [.WSObjectProperty](#module_wscodec/properties/object.WSObjectProperty)

<a name="module_wscodec/properties/object.ObjectRef"></a>

### wscodec/properties/object.ObjectRef
Decoded `ObjectProperty` value. Captures the wire's variable-shapestructure (kind / optional kindOnePrefix / optional path / optionalclassPath / optional embedded stream) so that any combination round-tripsbyte-identically.

**Kind**: static class of [<code>wscodec/properties/object</code>](#module_wscodec/properties/object)  

* [.ObjectRef](#module_wscodec/properties/object.ObjectRef)
    * [new exports.ObjectRef([fields])](#new_module_wscodec/properties/object.ObjectRef_new)
    * _instance_
        * [.hasEmbedded](#module_wscodec/properties/object.ObjectRef+hasEmbedded) ⇒ <code>boolean</code>
        * [.toBytes(writer, [opts])](#module_wscodec/properties/object.ObjectRef+toBytes)
    * _static_
        * [.fromReaderTopLevel(cursor, sizeHint, [ctx])](#module_wscodec/properties/object.ObjectRef.fromReaderTopLevel) ⇒ <code>ObjectRef</code>
        * [.fromReaderArrayElement(cursor, sizeHint, [ctx])](#module_wscodec/properties/object.ObjectRef.fromReaderArrayElement) ⇒ <code>ObjectRef</code>

<a name="new_module_wscodec/properties/object.ObjectRef_new"></a>

#### new exports.ObjectRef([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.kind] | <code>number</code> | <code>0x03</code> | First byte; selects the wire shape. |
| [fields.kindOnePrefix] | <code>number</code> \| <code>null</code> | <code></code> | Captured u32 that follows `kind` when `kind === 0x01`. |
| [fields.path] | <code>string</code> \| <code>null</code> | <code>null</code> | Object path FString, or null if absent on the wire. |
| [fields.pathIsNull] | <code>boolean</code> | <code>false</code> | FString null-form selector for an empty `path`. |
| [fields.classPath] | <code>string</code> \| <code>null</code> | <code>null</code> | Class path FString, or null if absent on the wire. |
| [fields.classPathIsNull] | <code>boolean</code> | <code>false</code> | FString null-form selector for an empty `classPath`. |
| [fields.embedded] | <code>PropertyStream</code> \| <code>null</code> | <code></code> | Nested property stream, or null if absent. |
| [fields.hasTerminatorTrailer] | <code>boolean</code> | <code>false</code> | True iff the embedded stream's None tag was followed by a 4-byte FName.Number=0. |

<a name="module_wscodec/properties/object.ObjectRef+hasEmbedded"></a>

#### objectRef.hasEmbedded ⇒ <code>boolean</code>
**Kind**: instance property of [<code>ObjectRef</code>](#module_wscodec/properties/object.ObjectRef)  
**Returns**: <code>boolean</code> - True iff `embedded` is a populated `PropertyStream`.  
<a name="module_wscodec/properties/object.ObjectRef+toBytes"></a>

#### objectRef.toBytes(writer, [opts])
Encode this `ObjectRef` to bytes.

**Kind**: instance method of [<code>ObjectRef</code>](#module_wscodec/properties/object.ObjectRef)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| writer | <code>Writer</code> |  |  |
| [opts] | <code>Object</code> |  |  |
| [opts.requireClassPath] | <code>boolean</code> | <code>false</code> | Force `classPath` emission even when it's null. Used by callers (e.g. array elements) where omitting it would create ambiguity. |
| [opts.ctx] | <code>Object</code> |  |  |

<a name="module_wscodec/properties/object.ObjectRef.fromReaderTopLevel"></a>

#### ObjectRef.fromReaderTopLevel(cursor, sizeHint, [ctx]) ⇒ <code>ObjectRef</code>
Top-level read: `sizeHint` is the tight per-property byte budget fromthe tag. The reader steps through kind / kindOnePrefix / path /classPath / embedded, falling out at each "exhausted budget" check.

**Kind**: static method of [<code>ObjectRef</code>](#module_wscodec/properties/object.ObjectRef)  

| Param | Type | Description |
| --- | --- | --- |
| cursor | <code>Cursor</code> |  |
| sizeHint | <code>number</code> | Tag-declared value byte budget. |
| [ctx] | <code>Object</code> |  |

<a name="module_wscodec/properties/object.ObjectRef.fromReaderArrayElement"></a>

#### ObjectRef.fromReaderArrayElement(cursor, sizeHint, [ctx]) ⇒ <code>ObjectRef</code>
Array-element read. `sizeHint` here is the REMAINING array budget,not a per-element bound, because ArrayProperty<Object> has no per-element delimiter on the wire. The four guards decide where thiselement actually ends.Heuristics preamble: ObjectProperty array elements have one of fourwire shapes, all back-to-back with no separator:  (A) kind-only         1 byte  (B) kind+path         1 byte + FString  (C) kind+path+class   1 byte + FString + FString  (D) kind+path+class+embedded property stream  (terminated by None)Each guard catches a different way the loose budget could mislead thereader into consuming the next element's bytes:- Guard 1: no room for even a null-form classPath FString (4 bytes).- Guard 2: peek classPath saveNum is implausibly large (|n| > 1024).- Guard 3: classPath's first content byte isn't `/` (Soulmask asset  paths are always `/Script/...` or `/Game/...`).- Guard 4: bytes following classPath don't look like a PropertyTag  start (small ANSI saveNum + identifier-start byte).

**Kind**: static method of [<code>ObjectRef</code>](#module_wscodec/properties/object.ObjectRef)  

| Param | Type | Description |
| --- | --- | --- |
| cursor | <code>Cursor</code> |  |
| sizeHint | <code>number</code> | Remaining array byte budget. |
| [ctx] | <code>Object</code> |  |

<a name="module_wscodec/properties/object.ObjectProperty"></a>

### wscodec/properties/object.ObjectProperty
Wrapper around `ObjectRef` that participates in the `Property` registry.Aliases (`ClassProperty`, `WeakObjectProperty`, `LazyObjectProperty`,`WSObjectProperty`) share the same wire layout; subclasses exist only so`tag.type` round-trips.

**Kind**: static class of [<code>wscodec/properties/object</code>](#module_wscodec/properties/object)  
<a name="new_module_wscodec/properties/object.ObjectProperty_new"></a>

#### new exports.ObjectProperty([fields])

| Param | Type | Default |
| --- | --- | --- |
| [fields] | <code>Object</code> |  | 
| [fields.tag] | <code>PropertyTag</code> |  | 
| [fields.value] | <code>ObjectRef</code> \| <code>null</code> | <code></code> | 

<a name="module_wscodec/properties/object.ClassProperty"></a>

### wscodec/properties/object.ClassProperty
Alias for `ObjectProperty` with `tag.type === 'ClassProperty'`.

**Kind**: static class of [<code>wscodec/properties/object</code>](#module_wscodec/properties/object)  
<a name="module_wscodec/properties/object.WeakObjectProperty"></a>

### wscodec/properties/object.WeakObjectProperty
Alias for `ObjectProperty` with `tag.type === 'WeakObjectProperty'`.

**Kind**: static class of [<code>wscodec/properties/object</code>](#module_wscodec/properties/object)  
<a name="module_wscodec/properties/object.LazyObjectProperty"></a>

### wscodec/properties/object.LazyObjectProperty
Alias for `ObjectProperty` with `tag.type === 'LazyObjectProperty'`.

**Kind**: static class of [<code>wscodec/properties/object</code>](#module_wscodec/properties/object)  
<a name="module_wscodec/properties/object.WSObjectProperty"></a>

### wscodec/properties/object.WSObjectProperty
Soulmask-specific alias for `ObjectProperty` (`tag.type === 'WSObjectProperty'`).

**Kind**: static class of [<code>wscodec/properties/object</code>](#module_wscodec/properties/object)
