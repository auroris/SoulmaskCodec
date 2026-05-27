# wscodec/properties/map

Source: [`src/properties/map.mjs`](../src/properties/map.mjs)

<a name="module_wscodec/properties/map"></a>

## wscodec/properties/map
`MapProperty`: ordered list of `{key, value}` entries with a preceding"keys to remove" list.Wire layout:  [int32 NumRemoved] [removed keys...] [int32 NumEntries]  [for each entry: key, value...]Soulmask quirks (matter for byte-identical round trip):1. `Map<Struct, _>` keys are EITHER raw 16-byte FGuids (the guild   manager maps in GAMEMODE) OR a nested property stream   (`XinQingTagLog` - where each key is a `TagName` NameProperty   wrapping a gameplay-effect tag identifier, terminated by None).   The two are distinguished by peeking ahead with   `peekLooksLikePropertyTag`.2. `Map<_, Struct>` values are EITHER a nested property stream   (`GongHuiMap`, `PlayerGongHuiDataMap`, `GeRenJianZhuYingHuoList`,   `GeRenMapRiZhi`) OR a raw 16-byte FGuid (`PlayerGongHuiMap` -   a player->guild membership lookup). The two are distinguished by   peeking ahead with `peekLooksLikePropertyTag`.Non-Struct key/value types share the array-element wire shape anddelegate to the shared element-codec.


* [wscodec/properties/map](#module_wscodec/properties/map)
    * _static_
        * [.MapProperty](#module_wscodec/properties/map.MapProperty)
            * [new exports.MapProperty([fields])](#new_module_wscodec/properties/map.MapProperty_new)
    * _inner_
        * [~MapEntry](#module_wscodec/properties/map..MapEntry) : <code>Object</code>

<a name="module_wscodec/properties/map.MapProperty"></a>

### wscodec/properties/map.MapProperty
Ordered map property.

**Kind**: static class of [<code>wscodec/properties/map</code>](#module_wscodec/properties/map)  
<a name="new_module_wscodec/properties/map.MapProperty_new"></a>

#### new exports.MapProperty([fields])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [fields] | <code>Object</code> |  |  |
| [fields.tag] | <code>PropertyTag</code> |  |  |
| [fields.removed] | <code>Array.&lt;\*&gt;</code> | <code>[]</code> | Removed keys. |
| [fields.entries] | <code>Array.&lt;MapEntry&gt;</code> | <code>[]</code> | Active `{key, value}` entries. |

<a name="module_wscodec/properties/map..MapEntry"></a>

### wscodec/properties/map~MapEntry : <code>Object</code>
Property wrapping an ordered map (with a separate "removed keys" list).Entries preserve their wire order on `this.entries`.

**Kind**: inner typedef of [<code>wscodec/properties/map</code>](#module_wscodec/properties/map)
