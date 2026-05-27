# wscodec/primitives

Source: [`src/primitives.mjs`](../src/primitives.mjs)

<a name="module_wscodec/primitives"></a>

## wscodec/primitives
FName and FGuid: the two pervasive identifier types in UE serialization.Soulmask's quirk for FName: the property-stream wire form is a plainFString (no trailing FName.Number int32). Stock UE 4.27 serializes FNameinside a property tag as FString + int32 Number; Soulmask drops the int32everywhere except the OUTERMOST None terminator (which still carries a4-byte FName.Number = 0 trailer, handled by the property-stream reader).`FName.fromReader` / instance `toBytes` therefore use the Soulmask form(bare FString). The full UE form is exposed separately as`FName.fromReaderWithNumber` / instance `toBytesWithNumber`: not used bySoulmask today, but wired up so the codec can speak the standard wireformat if the game's serializer ever adopts it.Method names match the codec convention (`fromReader` / `toBytes`)shared by PropertyTag, PropertyStream, Property subclasses, and thevalue classes (ObjectRef, StructValue, FTextValue, etc.).


* [wscodec/primitives](#module_wscodec/primitives)
    * [.FName](#module_wscodec/primitives.FName)
        * [new exports.FName(value, [opts])](#new_module_wscodec/primitives.FName_new)
        * _instance_
            * [.toString()](#module_wscodec/primitives.FName+toString) ⇒ <code>string</code>
            * [.toJSON()](#module_wscodec/primitives.FName+toJSON) ⇒ <code>string</code> \| <code>Object</code>
            * [.toBytes(writer)](#module_wscodec/primitives.FName+toBytes)
            * [.toBytesWithNumber(writer)](#module_wscodec/primitives.FName+toBytesWithNumber)
        * _static_
            * [.fromReader(cursor)](#module_wscodec/primitives.FName.fromReader) ⇒ <code>FName</code>
            * [.fromReaderWithNumber(cursor)](#module_wscodec/primitives.FName.fromReaderWithNumber) ⇒ <code>FName</code>
            * [.from(x)](#module_wscodec/primitives.FName.from) ⇒ <code>FName</code>
    * [.FGuid](#module_wscodec/primitives.FGuid)
        * [new exports.FGuid(value)](#new_module_wscodec/primitives.FGuid_new)
        * _instance_
            * [.toString()](#module_wscodec/primitives.FGuid+toString) ⇒ <code>string</code>
            * [.toJSON()](#module_wscodec/primitives.FGuid+toJSON) ⇒ <code>string</code>
            * [.equals(other)](#module_wscodec/primitives.FGuid+equals) ⇒ <code>boolean</code>
            * [.isZero()](#module_wscodec/primitives.FGuid+isZero) ⇒ <code>boolean</code>
            * [.toBytes(writer)](#module_wscodec/primitives.FGuid+toBytes)
        * _static_
            * [.zero()](#module_wscodec/primitives.FGuid.zero) ⇒ <code>FGuid</code>
            * [.fromReader(cursor)](#module_wscodec/primitives.FGuid.fromReader) ⇒ <code>FGuid</code>
            * [.from(x)](#module_wscodec/primitives.FGuid.from) ⇒ <code>FGuid</code>

<a name="module_wscodec/primitives.FName"></a>

### wscodec/primitives.FName
Unreal `FName`: an interned string used as a property name, enum member,type tag, asset path, etc. Carries enough wire metadata (`isUnicode`,`isNull`, `number`) to round-trip byte-identically.

**Kind**: static class of [<code>wscodec/primitives</code>](#module_wscodec/primitives)  

* [.FName](#module_wscodec/primitives.FName)
    * [new exports.FName(value, [opts])](#new_module_wscodec/primitives.FName_new)
    * _instance_
        * [.toString()](#module_wscodec/primitives.FName+toString) ⇒ <code>string</code>
        * [.toJSON()](#module_wscodec/primitives.FName+toJSON) ⇒ <code>string</code> \| <code>Object</code>
        * [.toBytes(writer)](#module_wscodec/primitives.FName+toBytes)
        * [.toBytesWithNumber(writer)](#module_wscodec/primitives.FName+toBytesWithNumber)
    * _static_
        * [.fromReader(cursor)](#module_wscodec/primitives.FName.fromReader) ⇒ <code>FName</code>
        * [.fromReaderWithNumber(cursor)](#module_wscodec/primitives.FName.fromReaderWithNumber) ⇒ <code>FName</code>
        * [.from(x)](#module_wscodec/primitives.FName.from) ⇒ <code>FName</code>

<a name="new_module_wscodec/primitives.FName_new"></a>

#### new exports.FName(value, [opts])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| value | <code>string</code> |  | The interned name (may be empty). |
| [opts] | <code>Object</code> |  |  |
| [opts.isUnicode] | <code>boolean</code> \| <code>null</code> | <code></code> | Explicit wire encoding. `null` lets the Writer auto-detect. |
| [opts.number] | <code>number</code> | <code>0</code> | FName.Number suffix (only used with `toBytesWithNumber`). |
| [opts.isNull] | <code>boolean</code> | <code>false</code> | When `value === ''`, true selects the FString null form on write. |

<a name="module_wscodec/primitives.FName+toString"></a>

#### fName.toString() ⇒ <code>string</code>
**Kind**: instance method of [<code>FName</code>](#module_wscodec/primitives.FName)  
**Returns**: <code>string</code> - The bare name string.  
<a name="module_wscodec/primitives.FName+toJSON"></a>

#### fName.toJSON() ⇒ <code>string</code> \| <code>Object</code>
JSON-friendly form. Returns the bare name string when all wire flagsare at their defaults (the common case); returns the rich object form`{value, isUnicode, isNull, number}` when any flag is non-default, sothe wire metadata round-trips through JSON. `FName.from` accepts bothshapes.

**Kind**: instance method of [<code>FName</code>](#module_wscodec/primitives.FName)  
<a name="module_wscodec/primitives.FName+toBytes"></a>

#### fName.toBytes(writer)
Write the Soulmask form (FString only).

**Kind**: instance method of [<code>FName</code>](#module_wscodec/primitives.FName)  

| Param | Type |
| --- | --- |
| writer | <code>Writer</code> | 

<a name="module_wscodec/primitives.FName+toBytesWithNumber"></a>

#### fName.toBytesWithNumber(writer)
Write the stock UE form (FString + int32 Number).

**Kind**: instance method of [<code>FName</code>](#module_wscodec/primitives.FName)  

| Param | Type |
| --- | --- |
| writer | <code>Writer</code> | 

<a name="module_wscodec/primitives.FName.fromReader"></a>

#### FName.fromReader(cursor) ⇒ <code>FName</code>
Read an FName in the Soulmask property-stream form: a bare FString,no trailing FName.Number. `number` is left at 0.

**Kind**: static method of [<code>FName</code>](#module_wscodec/primitives.FName)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 

<a name="module_wscodec/primitives.FName.fromReaderWithNumber"></a>

#### FName.fromReaderWithNumber(cursor) ⇒ <code>FName</code>
Read an FName in the stock UE 4.27 property-tag form: FString + int32Number. Use this if you're decoding a non-Soulmask stream or a futureSoulmask wire format that re-adopts the int32 suffix.

**Kind**: static method of [<code>FName</code>](#module_wscodec/primitives.FName)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 

<a name="module_wscodec/primitives.FName.from"></a>

#### FName.from(x) ⇒ <code>FName</code>
Coerce a value into an `FName`. Accepts an `FName` (returned as-is), abare string, or a plain `{value, isUnicode, isNull, number}` record.

**Kind**: static method of [<code>FName</code>](#module_wscodec/primitives.FName)  
**Throws**:

- <code>Error</code> If `x` is none of the supported shapes.


| Param | Type |
| --- | --- |
| x | <code>FName</code> \| <code>string</code> \| <code>Object</code> | 

<a name="module_wscodec/primitives.FGuid"></a>

### wscodec/primitives.FGuid
Unreal `FGuid`: 128-bit identifier stored as a canonical 8-4-4-4-12hex string (uppercase on the wire-read side; accepted in any case on input).

**Kind**: static class of [<code>wscodec/primitives</code>](#module_wscodec/primitives)  

* [.FGuid](#module_wscodec/primitives.FGuid)
    * [new exports.FGuid(value)](#new_module_wscodec/primitives.FGuid_new)
    * _instance_
        * [.toString()](#module_wscodec/primitives.FGuid+toString) ⇒ <code>string</code>
        * [.toJSON()](#module_wscodec/primitives.FGuid+toJSON) ⇒ <code>string</code>
        * [.equals(other)](#module_wscodec/primitives.FGuid+equals) ⇒ <code>boolean</code>
        * [.isZero()](#module_wscodec/primitives.FGuid+isZero) ⇒ <code>boolean</code>
        * [.toBytes(writer)](#module_wscodec/primitives.FGuid+toBytes)
    * _static_
        * [.zero()](#module_wscodec/primitives.FGuid.zero) ⇒ <code>FGuid</code>
        * [.fromReader(cursor)](#module_wscodec/primitives.FGuid.fromReader) ⇒ <code>FGuid</code>
        * [.from(x)](#module_wscodec/primitives.FGuid.from) ⇒ <code>FGuid</code>

<a name="new_module_wscodec/primitives.FGuid_new"></a>

#### new exports.FGuid(value)

| Param | Type | Description |
| --- | --- | --- |
| value | <code>string</code> | Canonical 8-4-4-4-12 hex string. |

<a name="module_wscodec/primitives.FGuid+toString"></a>

#### fGuid.toString() ⇒ <code>string</code>
**Kind**: instance method of [<code>FGuid</code>](#module_wscodec/primitives.FGuid)  
**Returns**: <code>string</code> - The canonical hex string.  
<a name="module_wscodec/primitives.FGuid+toJSON"></a>

#### fGuid.toJSON() ⇒ <code>string</code>
JSON-friendly form: the bare GUID string, so `JSON.stringify(fguid)`yields `"AABBCCDD-..."` rather than `{"value":"AABBCCDD-..."}`.

**Kind**: instance method of [<code>FGuid</code>](#module_wscodec/primitives.FGuid)  
<a name="module_wscodec/primitives.FGuid+equals"></a>

#### fGuid.equals(other) ⇒ <code>boolean</code>
Structural equality. Case-insensitive: an FGuid constructed from alowercase string compares equal to one read off the wire (uppercase).Accepts an FGuid or a string; anything else returns false.

**Kind**: instance method of [<code>FGuid</code>](#module_wscodec/primitives.FGuid)  

| Param | Type |
| --- | --- |
| other | <code>FGuid</code> \| <code>string</code> \| <code>\*</code> | 

<a name="module_wscodec/primitives.FGuid+isZero"></a>

#### fGuid.isZero() ⇒ <code>boolean</code>
True iff the GUID is all zeros (the conventional null-GUID sentinel).

**Kind**: instance method of [<code>FGuid</code>](#module_wscodec/primitives.FGuid)  
<a name="module_wscodec/primitives.FGuid+toBytes"></a>

#### fGuid.toBytes(writer)
Encode the GUID as 16 bytes (four little-endian uint32s).

**Kind**: instance method of [<code>FGuid</code>](#module_wscodec/primitives.FGuid)  
**Throws**:

- <code>Error</code> If the underlying string is not in canonical 8-4-4-4-12 form.


| Param | Type |
| --- | --- |
| writer | <code>Writer</code> | 

<a name="module_wscodec/primitives.FGuid.zero"></a>

#### FGuid.zero() ⇒ <code>FGuid</code>
All-zero FGuid sentinel. New instance per call (FGuid is mutable).

**Kind**: static method of [<code>FGuid</code>](#module_wscodec/primitives.FGuid)  
<a name="module_wscodec/primitives.FGuid.fromReader"></a>

#### FGuid.fromReader(cursor) ⇒ <code>FGuid</code>
Read 16 bytes and decode as an FGuid string.

**Kind**: static method of [<code>FGuid</code>](#module_wscodec/primitives.FGuid)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 

<a name="module_wscodec/primitives.FGuid.from"></a>

#### FGuid.from(x) ⇒ <code>FGuid</code>
Coerce a value into an `FGuid`. Accepts an `FGuid` (returned as-is)or a canonical 8-4-4-4-12 hex string.

**Kind**: static method of [<code>FGuid</code>](#module_wscodec/primitives.FGuid)  
**Throws**:

- <code>Error</code> If `x` is some other type.


| Param | Type |
| --- | --- |
| x | <code>FGuid</code> \| <code>string</code> |
