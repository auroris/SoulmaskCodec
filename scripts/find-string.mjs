#!/usr/bin/env node
/**
 * Search every actor_data blob in a Soulmask db for a given substring,
 * reporting actor_serial + property path for each hit. Used to locate
 * an in-game object you can recognize by an in-game string (a custom
 * chest name, an NPC's name, a log line, etc).
 *
 *   node scripts/find-string.mjs <path-to-world.db> <needle> [--limit N]
 *
 * Matches in: StrProperty values, NameProperty values, FString tag fields,
 * FText displayString / sourceString, FText namespace, FText key, and FText
 * NamedFormat argument keys. Case-sensitive substring search.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';

import { UnrealBlob } from '../src/wscodec.mjs';

const _lz4 = await import('lz4-wasm-nodejs');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const args = process.argv.slice(2);
const limitFlagIdx = args.indexOf('--limit');
const limit = limitFlagIdx >= 0 ? parseInt(args[limitFlagIdx + 1], 10) : Infinity;
if (limitFlagIdx >= 0) args.splice(limitFlagIdx, 2);
const dbPath = args[0];
const needle = args[1];
if (!dbPath || !needle) {
  console.error('Usage: node scripts/find-string.mjs <path-to-world.db> <needle> [--limit N]');
  process.exit(1);
}
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT actor_serial, actor_name, actor_script, actor_data FROM actor_table').all();

let hits = 0;
function checkString(s, path, hit) {
  if (typeof s !== 'string') return;
  if (s.includes(needle)) hit(path, s);
}

function visitFText(t, path, hit) {
  if (!t || typeof t !== 'object') return;
  if (t.historyType === -1) {
    checkString(t.displayString, path + '.displayString', hit);
  } else if (t.historyType === 0) {
    checkString(t.namespace,    path + '.namespace', hit);
    checkString(t.key,          path + '.key', hit);
    checkString(t.sourceString, path + '.sourceString', hit);
  } else if (t.historyType === 1) {
    visitFText(t.sourceFmt, path + '.sourceFmt', hit);
    for (let i = 0; i < (t.arguments || []).length; i++) {
      const a = t.arguments[i];
      checkString(a.key, path + `.arg[${i}].key`, hit);
      if (a.type === 4) visitFText(a.value, path + `.arg[${i}].value`, hit);
      else if (typeof a.value === 'string') checkString(a.value, path + `.arg[${i}].value`, hit);
    }
  } else if (t.historyType === 2) {
    visitFText(t.sourceFmt, path + '.sourceFmt', hit);
    for (let i = 0; i < (t.arguments || []).length; i++) {
      const a = t.arguments[i];
      if (a.type === 4) visitFText(a.value, path + `.arg[${i}].value`, hit);
      else if (typeof a.value === 'string') checkString(a.value, path + `.arg[${i}].value`, hit);
    }
  }
}

function visitElement(e, path, hit) {
  if (typeof e === 'string') checkString(e, path, hit);
  if (e?.constructor?.name === 'FName') checkString(e.value, path, hit);
  if (e?.historyType !== undefined) visitFText(e, path, hit);
  if (e?.constructor?.name === 'ObjectRef') {
    checkString(e.path, path + '.path', hit);
    checkString(e.classPath, path + '.classPath', hit);
    if (e.embedded?.properties) visitProperties(e.embedded.properties, path + '<embedded>', hit);
  }
  if (e?.constructor?.name === 'SoftObjectRef') {
    checkString(e.assetPath, path + '.assetPath', hit);
    checkString(e.subPath, path + '.subPath', hit);
  }
  if (e?.constructor?.name === 'StructValue' && e.form === 'propStream' && e.stream?.properties) {
    visitProperties(e.stream.properties, path + `<${e.structName}>`, hit);
  }
}

function visitProperties(props, path, hit) {
  for (const p of props) {
    const here = `${path}.${p.name}`;
    // Property's value field: scalar / FName / FText / ObjectRef / SoftObjectRef / StructValue.
    visitElement(p.value, here, hit);

    // ArrayProperty / SetProperty: elements live directly on the property.
    if (Array.isArray(p.elements)) {
      for (let i = 0; i < p.elements.length; i++) {
        visitElement(p.elements[i], `${here}[${i}]`, hit);
      }
    }

    // MapProperty: entries live directly on the property.
    if (Array.isArray(p.entries)) {
      for (let i = 0; i < p.entries.length; i++) {
        const ent = p.entries[i];
        visitElement(ent.key,   `${here}{${i}}.key`,   hit);
        visitElement(ent.value, `${here}{${i}}.value`, hit);
      }
    }
  }
}

for (const row of rows) {
  if (hits >= limit) break;
  if (!row.actor_data || row.actor_data.byteLength < 8) continue;
  const u8 = new Uint8Array(row.actor_data.buffer, row.actor_data.byteOffset, row.actor_data.byteLength);
  if (new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true) !== 2) continue;
  let inner; try { inner = _lz4.decompress(u8.subarray(4)); } catch { continue; }
  let blob; try { blob = UnrealBlob.fromBytes(inner); } catch { continue; }
  const localHits = [];
  visitProperties(blob.properties, '', (path, value) => {
    localHits.push({ path, value });
  });
  if (localHits.length === 0) continue;
  hits++;
  console.log(`serial=${row.actor_serial}  script=${row.actor_script || '(none)'}`);
  for (const h of localHits.slice(0, 10)) {
    const preview = h.value.length > 80 ? h.value.slice(0, 77) + '...' : h.value;
    console.log(`  ${h.path}:  ${JSON.stringify(preview)}`);
  }
  if (localHits.length > 10) console.log(`  ... and ${localHits.length - 10} more in this row`);
}
console.log('');
console.log(`Done. ${hits} actor(s) matched.`);
