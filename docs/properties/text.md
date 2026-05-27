# wscodec/properties/text

Source: [`src/properties/text.mjs`](../src/properties/text.mjs)

<a name="module_wscodec/properties/text"></a>

## wscodec/properties/text
`TextProperty` (FText) + `FTextValue`.UE4 FText wire format:  uint32  Flags  int8    HistoryType  HistoryType -1 (None / culture-invariant):      int32   bHasCultureInvariantString      [FString displayString]  HistoryType 0 (Base / localized):      FString Namespace      FString Key      FString SourceString  HistoryType 1 (NamedFormat):      FText   SourceFmt      int32   NumArguments      for each: FString Key, int8 ContentType, value-by-type      Soulmask uses this for named placeholders like "X={X} Y={Y} Z={Z}"      in ParamArrayTxt elements of JingYingRiZhiList.  HistoryType 2 (OrderedFormat):      FText   SourceFmt      int32   NumArguments      for each: int8 ContentType + value-by-type (positional, {0}/{1}/...)  HistoryType 4 (AsNumber, FTextHistory_AsNumber):      FFormatArgumentValue SourceValue (int8 type + value-by-type)      uint32 bHasFormatOptions  ← legacy UE3-style 4-byte bool, NOT 1-byte      [FNumberFormattingOptions FormatOptions]      uint32 bHasCulture      [FString TargetCulture]      FNumberFormattingOptions = AlwaysSign(uint32) + UseGrouping(uint32) +        RoundingMode(int8) + 4 x int32 digit-count fields.  HistoryType 11 (StringTableEntry, FTextHistory_StringTableEntry):      FName   TableId        // Soulmask form: bare FString, no int32 Number      FString Key      Soulmask uses this for log entries that reference a centralized      string table (e.g. GongHuiRiZhiData entries from BetterBonfires      and other DLC mods).  All other types: remaining bytes captured in `_raw` for verbatim  round-trip; the codec emits a warn (or throws under strict mode).ContentType codes (for HistoryType 1, 2, and 4's SourceValue):  0=Int(int64)  1=UInt(uint64)  2=Float(f32)  3=Double(f64)  4=Text(FText, recursive)  5=Gender(int8)


* [wscodec/properties/text](#module_wscodec/properties/text)
    * [.FTextValue](#module_wscodec/properties/text.FTextValue)
        * [new exports.FTextValue([fields])](#new_module_wscodec/properties/text.FTextValue_new)
        * _instance_
            * [.text](#module_wscodec/properties/text.FTextValue+text) ⇒ <code>string</code> \| <code>null</code>
        * _static_
            * [.fromReader(cursor, sizeHint, [ctx])](#module_wscodec/properties/text.FTextValue.fromReader) ⇒ <code>FTextValue</code>
    * [.TextProperty](#module_wscodec/properties/text.TextProperty)
        * [new exports.TextProperty([fields])](#new_module_wscodec/properties/text.TextProperty_new)

<a name="module_wscodec/properties/text.FTextValue"></a>

### wscodec/properties/text.FTextValue
Decoded `FText` value. Only the subset of fields relevant to the`historyType` is populated; see the module description for the wireshape per `historyType` value.

**Kind**: static class of [<code>wscodec/properties/text</code>](#module_wscodec/properties/text)  

* [.FTextValue](#module_wscodec/properties/text.FTextValue)
    * [new exports.FTextValue([fields])](#new_module_wscodec/properties/text.FTextValue_new)
    * _instance_
        * [.text](#module_wscodec/properties/text.FTextValue+text) ⇒ <code>string</code> \| <code>null</code>
    * _static_
        * [.fromReader(cursor, sizeHint, [ctx])](#module_wscodec/properties/text.FTextValue.fromReader) ⇒ <code>FTextValue</code>

<a name="new_module_wscodec/properties/text.FTextValue_new"></a>

#### new exports.FTextValue([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.flags] | <code>number</code> | <code>0</code> | FText flags (uint32). |
| [fields.historyType] | <code>number</code> | <code>-1</code> | One of -1, 0, 1, 2, 4, 11 (others captured as `_raw`). |
| [fields.displayString] | <code>string</code> |  | historyType=-1. |
| [fields.displayStringIsNull] | <code>boolean</code> | <code>false</code> | historyType=-1. |
| [fields.namespace] | <code>string</code> |  | historyType=0. |
| [fields.namespaceIsNull] | <code>boolean</code> | <code>false</code> | historyType=0. |
| [fields.key] | <code>string</code> |  | historyType=0. |
| [fields.keyIsNull] | <code>boolean</code> | <code>false</code> | historyType=0. |
| [fields.sourceString] | <code>string</code> |  | historyType=0. |
| [fields.sourceStringIsNull] | <code>boolean</code> | <code>false</code> | historyType=0. |
| [fields.sourceFmt] | <code>FTextValue</code> |  | historyType=1 or 2. |
| [fields.arguments] | <code>Array.&lt;Object&gt;</code> |  | historyType=1 (named) or 2 (positional). |
| [fields.sourceValue] | <code>Object</code> |  | historyType=4. |
| [fields.formatOptions] | <code>Object</code> \| <code>null</code> |  | historyType=4. |
| [fields.culture] | <code>string</code> \| <code>null</code> |  | historyType=4. |
| [fields.cultureIsNull] | <code>boolean</code> | <code>false</code> | historyType=4. |
| [fields.tableId] | <code>FName</code> |  | historyType=11. |
| [fields.tableKey] | <code>string</code> |  | historyType=11. |
| [fields.tableKeyIsNull] | <code>boolean</code> | <code>false</code> | historyType=11. |
| [fields._raw] | <code>Uint8Array</code> |  | Verbatim bytes for unhandled `historyType` values. |

<a name="module_wscodec/properties/text.FTextValue+text"></a>

#### fTextValue.text ⇒ <code>string</code> \| <code>null</code>
Best displayable string for this FText, or null if none.

**Kind**: instance property of [<code>FTextValue</code>](#module_wscodec/properties/text.FTextValue)  
<a name="module_wscodec/properties/text.FTextValue.fromReader"></a>

#### FTextValue.fromReader(cursor, sizeHint, [ctx]) ⇒ <code>FTextValue</code>
Read an FText. `sizeHint` is the byte budget when called as a top-levelTextProperty value or inside a finite-budget container; pass `Infinity`when reading inside a self-delimiting context (array element, structfield) and an unknown `historyType` cannot be captured.

**Kind**: static method of [<code>FTextValue</code>](#module_wscodec/properties/text.FTextValue)  

| Param | Type |
| --- | --- |
| cursor | <code>Cursor</code> | 
| sizeHint | <code>number</code> | 
| [ctx] | <code>Object</code> | 

<a name="module_wscodec/properties/text.TextProperty"></a>

### wscodec/properties/text.TextProperty
Property wrapping an `FTextValue`. When a decode failure occurs innon-strict mode, `value` is an `OpaqueValue` instead so the surroundingstream stays aligned.

**Kind**: static class of [<code>wscodec/properties/text</code>](#module_wscodec/properties/text)  
<a name="new_module_wscodec/properties/text.TextProperty_new"></a>

#### new exports.TextProperty([fields])

| Param | Type | Default |
| --- | --- | --- |
| [fields] | <code>Object</code> |  | 
| [fields.tag] | <code>PropertyTag</code> |  | 
| [fields.value] | <code>FTextValue</code> \| <code>OpaqueValue</code> \| <code>null</code> | <code></code> |
