# wscodec/translations

Source: [`src/translations.mjs`](../src/translations.mjs)

<a name="module_wscodec/translations"></a>

## wscodec/translations
Soulmask game-data name lookups.

Resolves the class names, object paths, and IDs that wscodec decodes from
actor blobs into English display names.

**Example**  
```js
import { translate, item, npc } from 'wscodec/translations';

item('/Game/Blueprints/DaoJu/.../BP_WuQi_Dao_2.BP_WuQi_Dao_2_C'); // 'Beast Bone Blade'
npc('BP_DongWu_Base_C');                                           // NPC display name
proficiency('FaMu');                                               // 'Logging'

Names only - no descriptions, icons, or stats. Data is generated from the
game's CSV export by `scripts/build-translations.mjs`; regenerate after a
game patch. Zero dependencies, runs anywhere wscodec does.
```

* [wscodec/translations](#module_wscodec/translations)
    * [.item(classOrPath)](#module_wscodec/translations.item) ⇒ <code>string</code> \| <code>null</code>
    * [.npc(classOrPath)](#module_wscodec/translations.npc) ⇒ <code>string</code> \| <code>null</code>
    * [.building(classOrPath)](#module_wscodec/translations.building) ⇒ <code>string</code> \| <code>null</code>
    * [.recipe(id)](#module_wscodec/translations.recipe) ⇒ <code>string</code> \| <code>null</code>
    * [.proficiency(id)](#module_wscodec/translations.proficiency) ⇒ <code>string</code> \| <code>null</code>
    * [.mastery(id)](#module_wscodec/translations.mastery) ⇒ <code>string</code> \| <code>null</code>
    * [.attribute(id)](#module_wscodec/translations.attribute) ⇒ <code>string</code> \| <code>null</code>
    * [.fashion(id)](#module_wscodec/translations.fashion) ⇒ <code>string</code> \| <code>null</code>
    * [.tattoo(id)](#module_wscodec/translations.tattoo) ⇒ <code>string</code> \| <code>null</code>
    * [.gift(id)](#module_wscodec/translations.gift) ⇒ <code>string</code> \| <code>null</code>
    * [.setting(id)](#module_wscodec/translations.setting) ⇒ <code>string</code> \| <code>null</code>
    * [.category(id)](#module_wscodec/translations.category) ⇒ <code>string</code> \| <code>null</code>
    * [.translate(key, [kind])](#module_wscodec/translations.translate) ⇒ <code>string</code> \| <code>null</code>

<a name="module_wscodec/translations.item"></a>

### wscodec/translations.item(classOrPath) ⇒ <code>string</code> \| <code>null</code>
Item display name, by class FName or full object path.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| classOrPath | <code>string</code> | 

<a name="module_wscodec/translations.npc"></a>

### wscodec/translations.npc(classOrPath) ⇒ <code>string</code> \| <code>null</code>
NPC display name, by character class.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| classOrPath | <code>string</code> | 

<a name="module_wscodec/translations.building"></a>

### wscodec/translations.building(classOrPath) ⇒ <code>string</code> \| <code>null</code>
Building / workbench display name, by class.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| classOrPath | <code>string</code> | 

<a name="module_wscodec/translations.recipe"></a>

### wscodec/translations.recipe(id) ⇒ <code>string</code> \| <code>null</code>
Recipe display name, by recipe id (e.g. `WuQI_Dao_2`).

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.proficiency"></a>

### wscodec/translations.proficiency(id) ⇒ <code>string</code> \| <code>null</code>
Proficiency display name, by proficiency id (e.g. `FaMu`).

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.mastery"></a>

### wscodec/translations.mastery(id) ⇒ <code>string</code> \| <code>null</code>
Mastery / combat-skill display name, by numeric id.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.attribute"></a>

### wscodec/translations.attribute(id) ⇒ <code>string</code> \| <code>null</code>
Attribute display name, by attribute class.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.fashion"></a>

### wscodec/translations.fashion(id) ⇒ <code>string</code> \| <code>null</code>
Fashion / cosmetic display name, by fashion id.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.tattoo"></a>

### wscodec/translations.tattoo(id) ⇒ <code>string</code> \| <code>null</code>
Tattoo display name, by tattoo part id.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.gift"></a>

### wscodec/translations.gift(id) ⇒ <code>string</code> \| <code>null</code>
NPC gift / trait display name, by gift id.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.setting"></a>

### wscodec/translations.setting(id) ⇒ <code>string</code> \| <code>null</code>
Game-rule setting display name, by setting code (e.g. `ExpRatio`).

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.category"></a>

### wscodec/translations.category(id) ⇒ <code>string</code> \| <code>null</code>
Item-category display name, by category id.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  

| Param | Type |
| --- | --- |
| id | <code>string</code> \| <code>number</code> | 

<a name="module_wscodec/translations.translate"></a>

### wscodec/translations.translate(key, [kind]) ⇒ <code>string</code> \| <code>null</code>
Resolve a key to a display name.

With no `kind`, scans every table and returns the first match - handy
when the key's category is unknown (e.g. a class path off a decoded
`ObjectRef`). Pass `kind` - a table name like `'items'` or `'gifts'` -
to look in exactly one table. `kind` is needed to disambiguate the ~39
numeric IDs that exist in more than one table: Soulmask reuses ID
ranges across fashion, gifts, and others.

**Kind**: static method of [<code>wscodec/translations</code>](#module_wscodec/translations)  
**Returns**: <code>string</code> \| <code>null</code> - Display name, or `null` if not found.  
**Throws**:

- <code>Error</code> If `kind` names no known table.


| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> \| <code>number</code> | Class name, object path, or numeric id. |
| [kind] | <code>string</code> | Optional table name to restrict the lookup to. |

**Example**  
```js
translate('BP_WuQi_Dao_2_C');   // 'Beast Bone Blade'
translate(100011);              // first match across all tables
translate(100011, 'gifts');     // 'Swift Pace'
```
