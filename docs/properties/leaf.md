# wscodec/properties/leaf

Source: [`src/properties/leaf.mjs`](../src/properties/leaf.mjs)

<a name="module_wscodec/properties/leaf"></a>

## wscodec/properties/leaf
Leaf property types: primitives whose value is a single number, bool,string, or FName. No nested decoding, no per-type wire quirks beyondwhat `Cursor`/`Writer` already provide.The nine numeric leaves are generated from `NUMERIC_LEAVES`; theless-uniform ones (Bool, Str, Name, Byte, Enum) are hand-writtenbecause each has a distinct twist (tag-stored value, isNull/isUnicodewire flags, dual form, FName coercion).The exported `IntProperty`, `Int8Property`, ..., `DoubleProperty` areconcrete subclasses of `Property`. Each one's `value` field holds thedecoded number (or decimal string for 64-bit integers).


* [wscodec/properties/leaf](#module_wscodec/properties/leaf)
    * [.BoolProperty](#module_wscodec/properties/leaf.BoolProperty)
        * [new exports.BoolProperty([fields])](#new_module_wscodec/properties/leaf.BoolProperty_new)
    * [.StrProperty](#module_wscodec/properties/leaf.StrProperty)
        * [new exports.StrProperty([fields])](#new_module_wscodec/properties/leaf.StrProperty_new)
    * [.NameProperty](#module_wscodec/properties/leaf.NameProperty)
    * [.EnumProperty](#module_wscodec/properties/leaf.EnumProperty)
    * [.ByteProperty](#module_wscodec/properties/leaf.ByteProperty)
        * [new exports.ByteProperty([fields])](#new_module_wscodec/properties/leaf.ByteProperty_new)

<a name="module_wscodec/properties/leaf.BoolProperty"></a>

### wscodec/properties/leaf.BoolProperty
Boolean leaf property. The value is stored on the tag itself (`tag.boolVal`);no payload bytes follow the tag on the wire.

**Kind**: static class of [<code>wscodec/properties/leaf</code>](#module_wscodec/properties/leaf)  
<a name="new_module_wscodec/properties/leaf.BoolProperty_new"></a>

#### new exports.BoolProperty([fields])

| Param | Type | Default |
| --- | --- | --- |
| [fields] | <code>Object</code> |  | 
| [fields.tag] | <code>PropertyTag</code> |  | 
| [fields.value] | <code>boolean</code> | <code>false</code> | 

<a name="module_wscodec/properties/leaf.StrProperty"></a>

### wscodec/properties/leaf.StrProperty
String leaf. Carries `isUnicode` and `isNull` flags so the FString wireencoding (ANSI vs UTF-16, null-form vs empty-with-terminator) round-tripsbyte-identically.

**Kind**: static class of [<code>wscodec/properties/leaf</code>](#module_wscodec/properties/leaf)  
<a name="new_module_wscodec/properties/leaf.StrProperty_new"></a>

#### new exports.StrProperty([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.tag] | <code>PropertyTag</code> |  |  |
| [fields.value] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | Decoded string. |
| [fields.isNull] | <code>boolean</code> | <code>false</code> | Empty-value wire-form selector. |
| [fields.isUnicode] | <code>boolean</code> \| <code>null</code> | <code></code> | Explicit wire encoding; null auto-detects. |

<a name="module_wscodec/properties/leaf.NameProperty"></a>

### wscodec/properties/leaf.NameProperty
`NameProperty`: leaf whose value is an `FName`. Same wire shape as`EnumProperty`; kept as separate classes so `tag.type` round-trips.

**Kind**: static class of [<code>wscodec/properties/leaf</code>](#module_wscodec/properties/leaf)  
<a name="module_wscodec/properties/leaf.EnumProperty"></a>

### wscodec/properties/leaf.EnumProperty
`EnumProperty`: leaf whose value is the enum member's `FName`.

**Kind**: static class of [<code>wscodec/properties/leaf</code>](#module_wscodec/properties/leaf)  
<a name="module_wscodec/properties/leaf.ByteProperty"></a>

### wscodec/properties/leaf.ByteProperty
Single-byte leaf. Dual wire form: when `tag.enumName.value === 'None'` thevalue is a raw u8 (0..255); otherwise it's the FName of an enum member.

**Kind**: static class of [<code>wscodec/properties/leaf</code>](#module_wscodec/properties/leaf)  
<a name="new_module_wscodec/properties/leaf.ByteProperty_new"></a>

#### new exports.ByteProperty([fields])

| Param | Type | Default |
| --- | --- | --- |
| [fields] | <code>Object</code> |  | 
| [fields.tag] | <code>PropertyTag</code> |  | 
| [fields.value] | <code>number</code> \| <code>FName</code> | <code>0</code> |
