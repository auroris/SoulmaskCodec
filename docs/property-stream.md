# wscodec/property-stream

Source: [`src/property-stream.mjs`](../src/property-stream.mjs)

<a name="module_wscodec/property-stream"></a>

## wscodec/property-stream
PropertyStream: an ordered list of Property objects terminated by a"None" tag. This is the recursive unit of the codec - it appears as:1. The top-level body of an UnrealBlob (with a 4-byte FName.Number   trailer after the None terminator).2. The value of an unknown-shape StructProperty.3. The `embedded` field of an ObjectRef.4. Each element of an ArrayProperty<StructProperty>.5. The value side of a MapProperty<_, StructProperty> entry, when the   wire shape is a property stream rather than a raw 16-byte FGuid.The outermost stream's None tag is followed by a 4-byte FName.Number=0trailer; nested streams typically aren't, except for certain Soulmaskembedded streams (e.g. JianZhuInstGLQComponent) that DO carry the trailer.`terminatorTrailer` captures which form was on the wire so write canreproduce it.


* [wscodec/property-stream](#module_wscodec/property-stream)
    * [.PropertyStream](#module_wscodec/property-stream.PropertyStream)
        * [new exports.PropertyStream([fields])](#new_module_wscodec/property-stream.PropertyStream_new)
        * _instance_
            * [.toBytes(writer, [opts])](#module_wscodec/property-stream.PropertyStream+toBytes)
            * [.toJSON()](#module_wscodec/property-stream.PropertyStream+toJSON) ⇒ <code>Object</code>
        * _static_
            * [.fromReader(cursor, [endOffset], [opts])](#module_wscodec/property-stream.PropertyStream.fromReader) ⇒ <code>PropertyStream</code>
            * [.fromJSON(j)](#module_wscodec/property-stream.PropertyStream.fromJSON) ⇒ <code>PropertyStream</code>
    * [.peekLooksLikePropertyTag(cursor)](#module_wscodec/property-stream.peekLooksLikePropertyTag) ⇒ <code>boolean</code>

<a name="module_wscodec/property-stream.PropertyStream"></a>

### wscodec/property-stream.PropertyStream
Ordered list of decoded `Property` objects with a terminator flag andan optional trailing FName.Number=0 record.

**Kind**: static class of [<code>wscodec/property-stream</code>](#module_wscodec/property-stream)  

* [.PropertyStream](#module_wscodec/property-stream.PropertyStream)
    * [new exports.PropertyStream([fields])](#new_module_wscodec/property-stream.PropertyStream_new)
    * _instance_
        * [.toBytes(writer, [opts])](#module_wscodec/property-stream.PropertyStream+toBytes)
        * [.toJSON()](#module_wscodec/property-stream.PropertyStream+toJSON) ⇒ <code>Object</code>
    * _static_
        * [.fromReader(cursor, [endOffset], [opts])](#module_wscodec/property-stream.PropertyStream.fromReader) ⇒ <code>PropertyStream</code>
        * [.fromJSON(j)](#module_wscodec/property-stream.PropertyStream.fromJSON) ⇒ <code>PropertyStream</code>

<a name="new_module_wscodec/property-stream.PropertyStream_new"></a>

#### new exports.PropertyStream([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.properties] | <code>Array.&lt;Property&gt;</code> | <code>[]</code> |  |
| [fields.terminated] | <code>boolean</code> | <code>false</code> | True iff a None tag was observed at the end of the stream. |
| [fields.terminatorTrailer] | <code>boolean</code> | <code>false</code> | True iff a 4-byte FName.Number=0 followed the None tag. |

<a name="module_wscodec/property-stream.PropertyStream+toBytes"></a>

#### propertyStream.toBytes(writer, [opts])
Write the properties, then a None terminator. The trailer (4-byteFName.Number=0) is emitted when `this.terminatorTrailer` is true ORthe caller passes `emitTerminatorTrailer: true` (top-level stream).

**Kind**: instance method of [<code>PropertyStream</code>](#module_wscodec/property-stream.PropertyStream)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| writer | <code>Writer</code> |  |  |
| [opts] | <code>Object</code> |  |  |
| [opts.emitTerminatorTrailer] | <code>boolean</code> | <code>false</code> | Force the trailer regardless of `this.terminatorTrailer`. |
| [opts.ctx] | <code>Object</code> |  |  |

<a name="module_wscodec/property-stream.PropertyStream+toJSON"></a>

#### propertyStream.toJSON() ⇒ <code>Object</code>
**Kind**: instance method of [<code>PropertyStream</code>](#module_wscodec/property-stream.PropertyStream)  
**Returns**: <code>Object</code> - JSON form preserving terminator flags.  
<a name="module_wscodec/property-stream.PropertyStream.fromReader"></a>

#### PropertyStream.fromReader(cursor, [endOffset], [opts]) ⇒ <code>PropertyStream</code>
Read properties until either a None terminator or `endOffset` is reached.`consumeTerminatorTrailer` is true for the outermost stream. For nestedstreams pass false; callers (e.g. `ObjectRef.fromReaderTopLevel`) thatdetect a trailer in the embedded byte budget set `terminatorTrailer` onthe resulting stream after the fact.

**Kind**: static method of [<code>PropertyStream</code>](#module_wscodec/property-stream.PropertyStream)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| cursor | <code>Cursor</code> |  |  |
| [endOffset] | <code>number</code> | <code>Infinity</code> | Absolute cursor offset at which to stop reading. |
| [opts] | <code>Object</code> |  |  |
| [opts.consumeTerminatorTrailer] | <code>boolean</code> | <code>false</code> | Whether to consume the 4-byte FName.Number=0 trailer if present. |
| [opts.ctx] | <code>Object</code> |  |  |

<a name="module_wscodec/property-stream.PropertyStream.fromJSON"></a>

#### PropertyStream.fromJSON(j) ⇒ <code>PropertyStream</code>
**Kind**: static method of [<code>PropertyStream</code>](#module_wscodec/property-stream.PropertyStream)  

| Param | Type |
| --- | --- |
| j | <code>Object</code> | 

<a name="module_wscodec/property-stream.peekLooksLikePropertyTag"></a>

### wscodec/property-stream.peekLooksLikePropertyTag(cursor) ⇒ <code>boolean</code>
Peek the next bytes of `cursor` (without advancing): do they look likethe start of a PropertyTag (an FString that names a property)?Used inside Map<_,Struct> entry values where the wire shape is ambiguous -the same 4 bytes could be the SaveNum of a property-name FString or thefirst uint32 of an FGuid. A property name FString is:- int32 SaveNum > 0 and reasonably small (<= 64 chars in Soulmask)- SaveNum bytes of ANSI body whose last byte is NUL- body chars (minus NUL) are identifier-safe: A-Z, a-z, 0-9, _Random GUID bytes effectively never satisfy this: the first uint32 is~uniform over [0, 2^32), and even when it lands in a plausible-lengthrange the printable-ASCII + NUL-terminator check eliminates the falsepositives.Limitation: only matches ANSI property names (SaveNum > 0). EverySoulmask property name observed in world.db is ASCII; UTF-16 propertynames inside Map<_,Struct> would need an additional branch.

**Kind**: static method of [<code>wscodec/property-stream</code>](#module_wscodec/property-stream)  
**Returns**: <code>boolean</code> - True if the cursor's next bytes plausibly start a PropertyTag.  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> |
