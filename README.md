# wscodec

Pure-JS toolkit for Soulmask save files. The core is a codec for `actor_data`
property streams in Soulmask's `world.db` (Unreal Engine 4.27 `FPropertyTag`
wire format). 

- Zero runtime dependencies in the codec (`src/`).
- Round-trip byte-identical against every actor in test saves (run 
  `npm test -- "path/to/world.db"`).
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

UnrealBlob serves as your entry point.

```js
import { UnrealBlob } from 'wscodec';

// Decode the uncompressed property stream bytes.
const blob = UnrealBlob.fromBytes(uncompressedBytes);

// Walk top-level properties, or search anywhere in the tree.
const nameProp = blob.findProperty('JianZhuDisplayName');
const deepHit  = blob.findPropertyDeep('RongQiCunQuRiZhiData');

// Edit in place. Strings, numbers, ObjectRefs, arrays, maps all map to plain
// JS values you can mutate directly.
nameProp.value.displayString = "Auroris' Cabinet";

// Re-encode. Tag sizes are recomputed from the actual encoded value bytes,
// so any structural edit is safe.
const newBytes = blob.toBytes();
```

`fromBytes` accepts a second argument: pass `{ strict: true }` to
escalate opaque-fallback warnings (unknown property type, unfamiliar
FText history, delegate families, etc.) into thrown errors instead of
the default `console.warn` + capture-as-raw-bytes behavior.

```js
const blob = UnrealBlob.fromBytes(uncompressedBytes, { strict: true });
```

JSON is supported as an interchange format. Sentinel strings are used to
preserve `-0`, `Infinity`, and `NaN`.

```js
const json = blob.toJSONString(2);                 // 2-space indent
const back = UnrealBlob.fromJSONString(json);      // reconstruct
back.toBytes();                                    // re-encodes byte-identical
```

The argument to `toJSONString` is forwarded to `JSON.stringify` as its
`space` parameter: omit it (or pass `0`) for compact single-line output,
pass `1`–`10` for that many spaces per level, or pass a string like
`"\t"` to indent with that exact string.

### From a browser without a bundler

`dist/wscodec.global.js` is an IIFE bundle that exposes everything on
`window.wscodec`. Load it with a classic `<script>` tag — unpkg and
jsDelivr serve it directly from the npm package:

```html
<script src="https://unpkg.com/wscodec"></script>
<script>
  const blob = wscodec.UnrealBlob.fromBytes(uncompressedBytes);
  // window.wscodec re-exports the same surface as the ESM build.
</script>
```

Translations ship as a separate per-language bundle on `window.wscodecTranslations`
(pick the language file you need - `en`, `de`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`, `zh`):

```html
<script src="https://unpkg.com/wscodec/dist/wscodec-translations.en.global.js"></script>
<script>
  wscodecTranslations.item('/Game/Blueprints/.../BP_WuQi_Dao_2_C');
</script>
```

For `<script type="module">`, point at `dist/wscodec.mjs` and use the
same `import { UnrealBlob } from '...'` syntax shown above.

### The actor_data envelope

`UnrealBlob.fromBytes` accepts the inner property stream only. Soulmask's
`actor_table.actor_data` column wraps that in an LZ4 envelope:

```
[0..3]  u32 LE   outer version tag = 0x00000002
[4..]   LZ4 block   decompresses to the bytes fromBytes accepts
```

When loading rows from world.db, use your favorite LZ4 decompresser
(I like to use `lz4-wasm-nodejs`):

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

Optional name lookups for the IDs and class names Soulmask uses. Import the
language you want - `en`, `de`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`, or `zh`;
each subpath exposes the same API:

```js
import { translate, item, npc, recipe } from 'wscodec/translations/en';

item('/Game/Blueprints/DaoJu/.../BP_WuQi_Dao_2.BP_WuQi_Dao_2_C'); // 'Beast Bone Blade'
npc('BP_DongWu_Base_C');                                          // NPC display name
recipe('WuQi_Dao_2');                                             // recipe name by id

// Generic lookup, scans every table until something matches.
translate('BP_WuQi_Dao_2_C');                                     // 'Beast Bone Blade'
translate(100011, 'gifts');                                       // disambiguate by table
```

There is no default language - the subpath is the language selector. To switch
language at runtime, dynamically import the one you need
(`await import('wscodec/translations/' + lang)`). To bind your own table set,
`createTranslations(tables)` is available from the locale-neutral
`wscodec/translations`.

Tables: `items`, `npcs`, `buildings`, `recipes`, `proficiencies`, `mastery`,
`attributes`, `fashion`, `tattoos`, `gifts`, `settings`, `categories`. Display
names only, no descriptions, icons, or stats.

Each language's tables are generated from the game's data export and committed
as `src/translations.data.<lang>.mjs`. Regenerate after a game patch with
`npm run build-translations` (see "Regenerating translations" below).

## Scripts

Utilities and tests. All take a `world.db` path as the first argument. The ones 
that write files default the output path next to the input.

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
| `node scripts/build-translations.mjs` (`npm run build-translations`) | Regenerate the per-language `src/translations.data.<lang>.mjs` tables from the CSV exports in `ext/<lang>/` (see below). |

The `test-edit-*.mjs` scripts in `scripts/` are edit recipes
against specific in-game objects (a named chest, a specific NPC's log,
a wall). Useful as templates for your own edits; see the file headers 
for the expected before/after.

### Regenerating translations

The translation tables ship pre-generated as `src/translations.data.<lang>.mjs`,
one per language. To rebuild from a fresh game patch:

1. Generate the CSV export with
   [SoulmaskDataMiner](https://github.com/auroris/SoulmaskDataMiner).
2. Drop each language export into `ext/<lang>/` at the repo root (gitignored),
   e.g. `ext/en/`, `ext/de/`. Languages are auto-discovered from these folders.
3. Run `npm run build-translations`.

Adding a language also needs a one-line `src/translations.<lang>.mjs` wrapper
and a matching `./translations/<lang>` entry in package.json `exports`; the
build prints a reminder if a language has data but no wrapper.

## Tests

All test scripts take an optional path to a `world.db` to test against.
Without an argument they look for `../world.db` relative to the repo root
(so a sibling save folder works without a flag).

```sh
npm test                    # runs every test:* script in package.json
npm run test:peek-fuzz      # adversarial fuzz for the FGuid-vs-tag peek heuristic
npm run test:roundtrip      # decode + re-encode every row, byte-identical check
npm run test:json-spot      # JSON round-trip on representative rows
npm run test:json-full      # JSON round-trip on every row
npm run test:dump-logs      # exercise the log dumper end-to-end

# Pass a save explicitly (note the `--` so npm forwards the arg):
npm test -- /path/to/world.db
node test/test-roundtrip.mjs /path/to/world.db
```

`test:roundtrip` is the primary regression tripwire: it decodes every
`actor_data` row, re-encodes via `toBytes()`, and reports the first byte
of divergence (with surrounding context) for any row that doesn't match.
`test:json-full` does the same end-to-end through the JSON layer. Decode
failures are bucketed by error pattern so identical bugs can be identified.

Exit code is non-zero if any decode failure, encode failure, or round-trip
mismatch is found.

## License

MIT. See [LICENSE](LICENSE).
