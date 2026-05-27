# wscodec

Pure-JS toolkit for Soulmask save files. The core is a codec for `actor_data`
property streams in Soulmask's `world.db` (Unreal Engine 4.27 `FPropertyTag`
wire format). Around that core sits a growing set of scripts for dumping,
editing, and re-importing whole saves.

- Zero runtime dependencies in the codec itself (`src/`).
- Round-trip byte-identical against every actor in test saves (run `npm test`
  with your own `world.db` to verify).
- Decode bytes to JS objects, edit, re-encode. Or convert to/from JSON for
  text-based editing and diffing.
- Optional translation tables map Soulmask's internal class names and IDs to
  English display names.

The dev dependencies (`better-sqlite3`, `lz4-wasm-nodejs`, `esbuild`) are only
used by the scripts and the build, not by the codec.

## Install

```sh
npm install wscodec
```

Requires Node 20+.

For browser use, the build emits IIFE, ESM, and CJS bundles in `dist/`. CDN
loaders can pull `wscodec.global.js` (window globals) or `wscodec.mjs`
(`<script type="module">`).

## How to use

The whole codec hangs off one class:

```js
import { UnrealBlob } from 'wscodec';

// Decode the uncompressed property stream bytes.
const blob = UnrealBlob.fromBytes(uncompressedBytes);

// Walk top-level properties, or search anywhere in the tree.
const nameProp = blob.findProperty('JianZhuDisplayName');
const deepHit  = blob.findPropertyDeep('RongQiCunQuRiZhiData');

// Edit in place. Strings, numbers, ObjectRefs, arrays, maps all map to plain
// JS values you can mutate directly.
nameProp.value.displayString = "Claude's Cabinet";

// Re-encode. Tag sizes are recomputed from the actual encoded value bytes,
// so any structural edit is safe.
const newBytes = blob.toBytes();
```

JSON is supported as an interchange format. `-0`, `Infinity`, and `NaN` survive
because the helpers substitute sentinel strings on the way out and restore them
on the way in:

```js
const json = blob.toJSONString(2);                 // pretty
const back = UnrealBlob.fromJSONString(json);      // reconstruct
back.toBytes();                                    // re-encodes byte-identical
```

### The actor_data envelope

`UnrealBlob.fromBytes` accepts the inner property stream only. Soulmask's
`actor_table.actor_data` column wraps that in an LZ4 envelope:

```
[0..3]  u32 LE   outer version tag = 0x00000002
[4..]   LZ4 block   decompresses to the bytes fromBytes accepts
```

The codec stays out of compression so it can stay dependency-free. Wrap it
with whatever LZ4 you prefer (the scripts use `lz4-wasm-nodejs`):

```js
import { UnrealBlob } from 'wscodec';
import * as lz4 from 'lz4-wasm-nodejs';

const inner = lz4.decompress(actorDataColumn.subarray(4));
const blob = UnrealBlob.fromBytes(inner);
// ...
const re = blob.toBytes();
const out = Buffer.concat([Buffer.from([2, 0, 0, 0]), Buffer.from(lz4.compress(re))]);
```

LZ4 has multiple valid encodings for the same payload, so the column bytes
themselves are not byte-stable across an edit-free round-trip. The
decompressed inner bytes are the canonical form and the level at which
round-trip tests check equality.

### Translations

Optional name lookups for the IDs and class names the codec returns. Shipped
as a separate import so a codec-only install pays nothing for it:

```js
import { translate, item, npc, recipe } from 'wscodec/translations';

item('/Game/Blueprints/DaoJu/.../BP_WuQi_Dao_2.BP_WuQi_Dao_2_C'); // 'Beast Bone Blade'
npc('BP_DongWu_Base_C');                                          // NPC display name
recipe('WuQi_Dao_2');                                             // recipe name by id

// Generic lookup, scans every table until something matches.
translate('BP_WuQi_Dao_2_C');                                     // 'Beast Bone Blade'
translate(100011, 'gifts');                                       // disambiguate by table
```

Tables: `items`, `npcs`, `buildings`, `recipes`, `proficiencies`, `mastery`,
`attributes`, `fashion`, `tattoos`, `gifts`, `settings`, `categories`. Display
names only, no descriptions, icons, or stats.

The tables are generated from the game's data export and committed in
`src/translations.data.mjs`. Regenerate after a game patch with
`npm run build-translations` (see "Regenerating translations" below).

## Scripts

End-to-end utilities that wrap the codec. All take a `world.db` path as the
first argument. The ones that write files default the output path next to the
input.

| Script | What it does |
| ------ | ------------ |
| `node scripts/db-to-json.mjs <world.db> [out.json] [--pretty]` | Export the entire SQLite save to a single JSON file. `actor_data` rows are decoded through wscodec; everything else (INTEGER, REAL, TEXT, BLOB, NULL) round-trips verbatim. Stream-writes so multi-hundred-MB saves don't blow Node's heap. |
| `node --max-old-space-size=4096 scripts/json-to-db.mjs <in.json> [out.db]` | Inverse of the above. Rebuilds a SQLite db from the JSON. The `actor_data` column is byte-identical at the uncompressed level (LZ4 itself may re-encode). |
| `node scripts/diff-dbs.mjs <a.db> <b.db>` | Confirm two databases round-trip equivalent. Compares schema verbatim and every cell, with `actor_data` compared at the uncompressed level. |
| `node scripts/dump-actor.mjs <world.db> <actor_serial> [out.json]` | Decode one actor and print its property tree as JSON. Handy for inspecting a single row. |
| `node scripts/dump-logs.mjs <world.db> [out.log]` | Merge workbench/chest access logs, NPC work logs, and clan logs into one timestamp-sorted text file shaped like the in-game log panel. |
| `node scripts/find-string.mjs <world.db> <needle> [--limit N]` | Substring search across every decoded blob (StrProperty, NameProperty, FText, etc.). Reports actor serial and property path for each hit. Useful for locating an in-game object you can recognize by a string. |
| `node scripts/npc-log-survey.mjs <world.db> [--tz-offset -6]` | Find the NPC with the most diverse set of work-log `Type` codes and print the most-recent entry for each. Used to cross-reference Type codes against the in-game text. |
| `node scripts/build.mjs` (`npm run build`) | Build the `dist/` bundles via esbuild. Runs automatically on `npm publish`. |
| `node scripts/build-translations.mjs` (`npm run build-translations`) | Regenerate `src/translations.data.mjs` from the CSV export in `ext/` (see below). |

The `test-edit-*.mjs` scripts in `scripts/` are end-to-end edit recipes
against specific in-game objects (a named chest, a specific NPC's log,
a wall). They served as the fixtures for verifying round-trip writes
preserved their changes after re-import. Useful as templates for your
own edits; see the file headers for the expected before/after.

### Regenerating translations

The translation tables ship pre-generated in `src/translations.data.mjs`,
so a normal install/build doesn't need anything in `ext/`. To rebuild from
a fresh game patch:

1. Generate the CSV export with
   [SoulmaskDataMiner](https://github.com/auroris/SoulmaskDataMiner).
2. Drop the export into `ext/` at the repo root (gitignored).
3. Run `npm run build-translations`.

`ext/` is not bundled in this repo; it's raw extracted data sized in the
hundreds of MB.

## Tests

All test scripts take an optional path to a `world.db` to test against.
Without an argument they look for `../world.db` relative to the repo root
(so a sibling save folder works without a flag).

```sh
npm test                    # runs every test:* script in package.json
npm run test:roundtrip      # decode + re-encode every row, byte-identical check
npm run test:json-spot      # JSON round-trip on representative rows
npm run test:json-full      # JSON round-trip on every row
npm run test:dump-logs      # exercise the log dumper end-to-end

# Pass a save explicitly:
node test/test-roundtrip.mjs /path/to/world.db
```

`test:roundtrip` is the primary regression tripwire: it decodes every
`actor_data` row, re-encodes via `toBytes()`, and reports the first byte
of divergence (with surrounding context) for any row that doesn't match.
`test:json-full` does the same end-to-end through the JSON layer. Decode
failures are bucketed by error pattern so identical bugs collapse to one
line in the report.

Exit code is non-zero if any decode failure, encode failure, or round-trip
mismatch is found.

## License

MIT. See [LICENSE](LICENSE).
