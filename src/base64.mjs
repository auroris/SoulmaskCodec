/**
 * Base64 helpers used by every codec class that has to escape raw bytes
 * into JSON (OpaqueProperty, OpaqueValue, FText _raw fallback, Delegate,
 * ArrayProperty perElementTrailings sometimes, UnrealBlob.bodyTrailing).
 *
 * Centralized so the Buffer import + the encode/decode pair only live in
 * one place; every other file imports `b64encode` / `b64decode` from here.
 */

import { Buffer } from 'node:buffer';

export function b64encode(u8) {
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
}

export function b64decode(s) {
  return new Uint8Array(Buffer.from(s, 'base64'));
}
