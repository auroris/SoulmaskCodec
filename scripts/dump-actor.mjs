#!/usr/bin/env node
/**
 * Decode one actor and print its property tree as JSON to stdout (or a file).
 *   node scripts/dump-actor.mjs <db> <actor_serial> [output.json]
 *
 * Convenience wrapper around UnrealBlob.decode + blobToJSON for inspecting a
 * single row.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';

import { UnrealBlob, blobToJSONString } from '../src/wscodec.mjs';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = process.argv[2];
const serial = process.argv[3] ? parseInt(process.argv[3], 10) : null;
const outPath = process.argv[4];
if (!dbPath || !Number.isFinite(serial)) {
  console.error('Usage: node scripts/dump-actor.mjs <db> <actor_serial> [output.json]');
  process.exit(1);
}
const db = new Database(dbPath, { readonly: true });
const row = db.prepare('SELECT actor_serial, actor_name, actor_script, actor_data FROM actor_table WHERE actor_serial=?').get(serial);
if (!row) { console.error(`row not found: serial=${serial}`); process.exit(1); }
const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
const inner = _lz4.decompress(u8.subarray(4));
const blob = UnrealBlob.decode(inner);
const out = blobToJSONString(blob, 2);
if (outPath) {
  fs.writeFileSync(outPath, out);
  console.error(`wrote ${out.length} bytes to ${outPath}`);
  console.error(`actor: serial=${row.actor_serial}, script=${row.actor_script}`);
} else {
  process.stdout.write(out);
}
