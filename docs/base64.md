# wscodec/base64

Source: [`src/base64.mjs`](../src/base64.mjs)

<a name="module_wscodec/base64"></a>

## wscodec/base64
Base64 helpers used by every codec class that has to escape raw bytesinto JSON (OpaqueProperty, OpaqueValue, FText `_raw` fallback, Delegate,ArrayProperty `perElementTrailings` sometimes, `UnrealBlob.bodyTrailing`).Pure-JS implementation using the `btoa` / `atob` globals - available inevery modern browser and in Node >= 16. No `node:buffer` import, so thisfile bundles cleanly for the browser builds. Encoding is chunked tostay under `String.fromCharCode.apply`'s argument-count cap on largeUint8Arrays (typical browsers limit at ~64K args).


* [wscodec/base64](#module_wscodec/base64)
    * [.b64encode(u8)](#module_wscodec/base64.b64encode) ⇒ <code>string</code>
    * [.b64decode(s)](#module_wscodec/base64.b64decode) ⇒ <code>Uint8Array</code>

<a name="module_wscodec/base64.b64encode"></a>

### wscodec/base64.b64encode(u8) ⇒ <code>string</code>
Encode raw bytes as a standard base64 string.

**Kind**: static method of [<code>wscodec/base64</code>](#module_wscodec/base64)  
**Returns**: <code>string</code> - Base64-encoded string.  

| Param | Type | Description |
| --- | --- | --- |
| u8 | <code>Uint8Array</code> | Bytes to encode. |

<a name="module_wscodec/base64.b64decode"></a>

### wscodec/base64.b64decode(s) ⇒ <code>Uint8Array</code>
Decode a standard base64 string back to raw bytes.

**Kind**: static method of [<code>wscodec/base64</code>](#module_wscodec/base64)  
**Returns**: <code>Uint8Array</code> - Decoded bytes.  

| Param | Type | Description |
| --- | --- | --- |
| s | <code>string</code> | Base64-encoded string. |
