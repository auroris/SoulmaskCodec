/**
 * Base64 helpers used by every codec class that has to escape raw bytes
 * into JSON (OpaqueProperty, OpaqueValue, FText `_raw` fallback, Delegate,
 * ArrayProperty `perElementTrailings` sometimes, `UnrealBlob.bodyTrailing`).
 *
 * Pure-JS implementation using the `btoa` / `atob` globals - available in
 * every modern browser and in Node >= 16. No `node:buffer` import, so this
 * file bundles cleanly for the browser builds. Encoding is chunked to
 * stay under `String.fromCharCode.apply`'s argument-count cap on large
 * Uint8Arrays (typical browsers limit at ~64K args).
 *
 * @module wscodec/base64
 */

const CHUNK = 0x8000;

/**
 * Encode raw bytes as a standard base64 string.
 *
 * @param {Uint8Array} u8 - Bytes to encode.
 * @returns {string} Base64-encoded string.
 */
export function b64encode(u8) {
  let bin = '';
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * Decode a standard base64 string back to raw bytes.
 *
 * @param {string} s - Base64-encoded string.
 * @returns {Uint8Array} Decoded bytes.
 */
export function b64decode(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
