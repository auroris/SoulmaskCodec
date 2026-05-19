# wscodec

Pure-JS codec for Soulmask `actor_data` property streams. Soulmask is a
survival game whose dedicated server stores world state in a `world.db`
SQLite file; every actor's serialized state lives in the `actor_data`
column as an LZ4-compressed UE 4.27 `FPropertyTag` byte stream with a
few Soulmask-specific quirks layered on top.

wscodec parses the property stream into a JavaScript object tree and
serializes it back. Repo: https://github.com/auroris/SoulmaskCodec.

Zero runtime dependencies. Accepts uncompressed bytes, returns
JavaScript objects, and vice versa. Round-trip is byte-identical
against every actor in a tested `world.db` (`npm test`).

## Scope

The library covers the property-stream wire format only. Soulmask's
column wire format adds an outer LZ4 envelope on top:

```
actor_data column bytes
├── [0..3]  u32 LE     outer version tag = 0x00000002
└── [4..]   LZ4 block  size-prefixed; decompresses to:
            ├── [0..3]  u32 LE  inner version tag = 0x00000002
            └── [4..]   FPropertyTag stream + "None" terminator
```

wscodec handles the bottom half (the bytes that come out of LZ4
decompression). The caller handles LZ4. See "LZ4 integration" below
for a copy-paste recipe with `lz4-wasm-nodejs`.

The SQLite `actor_table.data_version` column stores the NEGATIVE of
the on-wire DataVersion. A healthy blob with wire `DataVersion=2`
lives in a row whose `data_version` column reads `-2`. The wire
bytes themselves are always the unsigned `0x00000002`.

## Setup

wscodec itself has zero runtime dependencies, but a realistic workflow
also needs LZ4 decompression and a SQLite reader. The recommended
stack:

1. **Node.js LTS.** Install from <https://nodejs.org/>. On Windows, tick
   the "Automatically install the necessary tools" checkbox in the
   installer; this pulls in the Visual Studio Build Tools and Python
   that `better-sqlite3` needs to compile its native bindings. Without
   them `npm install better-sqlite3` will fail with a node-gyp error.

2. **Install wscodec:**

   ```sh
   npm install wscodec
   ```

3. **Install the LZ4 + SQLite peers** when you need them:

   ```sh
   npm install lz4-wasm-nodejs better-sqlite3
   ```

   - `lz4-wasm-nodejs` is pure WASM, no build step.
   - `better-sqlite3` builds native bindings (hence the optional tools above).

The test suite uses both peers; if you're only consuming wscodec
programmatically against bytes you already have in memory, neither
peer is required.

## API

### Top-level

```js
import { UnrealBlob } from 'wscodec';

const blob = UnrealBlob.decode(uncompressedBytes); // Uint8Array to blob
const bytes = blob.serialize();                    // blob to Uint8Array
UnrealBlob.detect(u8);                              // sniff version tag, returns boolean
```

`UnrealBlob.decode(u8)` parses the version tag + property stream and
returns an `UnrealBlob` with:

| field | type | meaning |
|---|---|---|
| `versionTag` | `number` | the wire version tag (always 2 in the wild) |
| `properties` | `Property[]` | top-level property list |
| `terminated` | `boolean` | whether the stream ended on a `None` terminator |
| `bodyTrailing` | `Uint8Array \| null` | any bytes past the terminator (rare) |
| `error` | `string \| null` | populated when structural decode failed |
| `_raw` | `Uint8Array` | the input bytes, retained for pass-through serialize |
| `_dirty` | `boolean` | set by mutating callers to force re-encode |
| `_recomputeSizes` | `boolean` | when true, every `tag.size` is rewritten from the actual value byte count on serialize. Set automatically by `jsonToBlob`; see [Editing](#editing) |

`blob.serialize(options?)` returns a `Uint8Array`. When `_dirty` is
false it returns `_raw` verbatim (byte-identical pass-through). When
`_dirty` is true it re-emits the property stream from `properties` via
`writePropertyStream`. Pass `{ recomputeSizes: true }` (or set
`blob._recomputeSizes`) to recompute every `tag.size` from the actual
encoded value bytes — required after any edit that changes a
variable-length field.

`blob.findProperty(name)` returns the first top-level property whose
tag name matches, or `null`. It does NOT traverse into embedded
streams, struct values, array elements, or map entries; use
`blob.findPropertyDeep(name)` for a depth-first walk across the whole
property tree.

### Property tree

`blob.properties` is an array of `Property` instances. Each carries
a `PropertyTag` (`name`, `type`, `size`, ...) and a `value` whose
JavaScript shape depends on the tag's type:

| tag type | value shape |
|---|---|
| `IntProperty`, `FloatProperty`, `BoolProperty`, ... | plain JS primitive |
| `StrProperty`, `NameProperty` | string / `FName` |
| `StructProperty` | `StructValue`. `.value` is either a plain object for known binary structs (`Vector`, `Quat`, `Transform`, ...), an `FGuid` instance for the `Guid` struct, or a nested property array for unknown structs |
| `ArrayProperty`, `SetProperty` | `ArrayValue` / `SetValue` with `.elements` |
| `MapProperty` | `MapValue` with `.entries: [{ key, value }, ...]` and `.removed: [...]` |
| `ObjectProperty`, `ClassProperty`, `Weak*`, `Lazy*`, `WSObjectProperty` | `ObjectRef` (kind + optional path/classPath/embedded stream) |
| `SoftObjectProperty`, `SoftClassProperty` | `SoftObjectRef` (`assetPath`, `subPath`) |
| `TextProperty` | `FTextValue` (handles UE4 FText history types -1, 0, 1, 2, 4) |
| anything wscodec couldn't structurally decode | `OpaqueValue`. Bytes retained verbatim |

Submodule re-exports make the value classes importable directly:

```js
import { ObjectRef, SoftObjectRef, FTextValue, OpaqueValue, StructValue } from 'wscodec';
import { PropertyTag, ArrayValue, SetValue, MapValue } from 'wscodec';
import { FName, FGuid } from 'wscodec';
import { blobToJSON, jsonToBlob, blobToJSONString, jsonStringToBlob,
         jsonReplacer, jsonReviver } from 'wscodec';
```

Lower-level helpers (`Cursor`, `Writer`, `readPropertyStream`,
`writePropertyStream`, `readValue`, `writeValue`, `STRUCT_HANDLERS`,
`registerStructHandler`) are also exported for callers building
custom workflows on top.

### Extending the struct registry

`STRUCT_HANDLERS` is a mutable registry of binary struct handlers
(`Vector`, `Quat`, `Transform`, `Guid`, ...). Unknown struct names
fall through to the nested-property-stream path, which is correct
when the struct is tagged and byte-identical via `OpaqueValue` when
it isn't. To teach the codec a new binary shape, use
`registerStructHandler`:

```js
import { registerStructHandler, Cursor, Writer } from 'wscodec';

registerStructHandler('MyVector', {
  read:  (c) => ({ x: c.readFloat32(), y: c.readFloat32(), z: c.readFloat32() }),
  write: (w, v) => { w.writeFloat32(v.x); w.writeFloat32(v.y); w.writeFloat32(v.z); },
});
```

The helper validates that both `read(cursor)` and `write(writer, value)`
are functions. Register before calling `UnrealBlob.decode` on any blob
that uses the type.

### JSON conversion

The object tree round-trips through JSON. This is the recommended path
for editing: the tree becomes plain JSON, edits are plain JS object
mutations, and the JSON-to-blob pipeline handles size recomputation,
sentinel substitution for `-0` / `Infinity` / `NaN`, and base64 for the
small fraction of bytes that the codec doesn't structurally decode.

```js
import {
  UnrealBlob,
  blobToJSON, jsonToBlob,
  blobToJSONString, jsonStringToBlob,
} from 'wscodec';

const blob = UnrealBlob.decode(uncompressedBytes);

// Object-tree round trip (preserves -0 in memory via Object.is, but a
// naive JSON.stringify on the result would lose it; see below).
const obj  = blobToJSON(blob);
const blob2 = jsonToBlob(obj);

// String round trip — use this whenever the JSON crosses a stringify
// boundary (file I/O, sockets, etc.). The sentinels guard non-finite
// numbers and -0 across the conversion.
const json = blobToJSONString(blob, 2 /* optional indent */);
const blob3 = jsonStringToBlob(json);

// blob3.serialize() reproduces the input bytes (modulo the wire's
// optional "inflated tag.size" lies, which jsonToBlob normalizes).
```

`blobToJSON` produces a plain-object tree with:

- `FName` values flattened to bare strings (with metadata-object fallback only when `isUnicode`/`isNull`/`number` aren't defaults)
- `FGuid` flattened to its canonical 8-4-4-4-12 hex string
- `Int64Property` / `UInt64Property` / `DateTime` / `Timespan` as decimal strings
- `StructValue` discriminated by `form: "binary" | "propStream" | "decodeError"`
- `OpaqueValue` as `{ _opaque: true, bytes: <base64>, reason }`
- `bodyTrailing` as base64 when present
- `ArrayValue._perElementTrailings` (the `JianZhuInstYuanXings` per-piece placement cache) as `{ transforms: [[16 floats], …], ids: [u32, …], aux: [[16 floats], …] }` — see [Round-trip guarantees](#round-trip-guarantees) for the NaN-bit-preservation note

`jsonToBlob` returns an `UnrealBlob` with `_dirty = true` and
`_recomputeSizes = true`, so `blob.serialize()` will rewrite every
`tag.size` from the actual encoded value bytes. That makes the JSON
pipeline safe for arbitrary edits — including ones that change FString
lengths, add/remove array elements, or grow nested structs.

If you need to build a larger JSON envelope around an `UnrealBlob`
(e.g., a full db export), use `jsonReplacer` / `jsonReviver` with your
own `JSON.stringify` / `JSON.parse` calls so the same `-0`/`NaN`/`Infinity`
sentinels are applied uniformly:

```js
import { blobToJSON, jsonToBlob, jsonReplacer, jsonReviver } from 'wscodec';

const envelope = { actor_serial: 17, blob: blobToJSON(blob), other: '...' };
const text     = JSON.stringify(envelope, jsonReplacer);
const parsed   = JSON.parse(text, jsonReviver);
const blob2    = jsonToBlob(parsed.blob);
```

The codec is consumable as a submodule: `import { blobToJSON } from 'wscodec/json';`.

### Editing

Two paths are supported. For most edits, **go through JSON** ([§
JSON conversion](#json-conversion)) — it handles size recomputation
and numeric edge cases automatically. For low-level edits that
change zero-cost fields (numbers, bools, single bytes), you can also
mutate the object tree directly.

```js
import { UnrealBlob, FName } from 'wscodec';

const blob = UnrealBlob.decode(inner);

// (1) Edit a primitive value.
//     JianZhuHP (jianzhu = "building") is the building's HP property.
blob.findProperty('JianZhuHP').value = 100;

// (2) Replace an FName-typed value. NameProperty values are FName
//     instances, not bare strings.
blob.findProperty('CharacterClass').value = new FName('NPC_Skeleton');

// (3) Mutate a nested struct. Known binary structs (Vector, Quat, ...)
//     expose .value as a plain object.
const transform = blob.findProperty('Transform');
transform.value.value.translation = { x: 100, y: 200, z: 50 };

// (4) Append to an array. ArrayValue.elements is a plain JS array.
const inventory = blob.findProperty('InventoryItems');
inventory.value.elements.push(new FName('Item_Wood'));

// (5) Remove an element. Just splice it out; don't set null.
inventory.value.elements.splice(0, 1);

// Tell the encoder to (a) re-emit from properties at all, and (b)
// recompute every tag.size from the actual encoded value bytes. The
// recompute is REQUIRED whenever any edit could change a value's
// encoded byte count (FStrings, FText, array length, nested structs).
// It's free when nothing changed in size, so just turning it on by
// default for any direct edit is the safest path.
blob._dirty = true;
blob._recomputeSizes = true;

const updatedBytes = blob.serialize(); // re-emits from properties
```

Gotchas:

- `_dirty` and `_recomputeSizes` live on the root `UnrealBlob`, not on
  nested `Property` / `ArrayValue` / `StructValue` objects. Mutating a
  deep value without setting `blob._dirty = true` returns the original
  `_raw` bytes unchanged.
- `BoolProperty` values live in the `tag` (`tag.boolVal`), not in
  `property.value`. To flip a bool, edit `prop.tag.boolVal`.
- Removing a property means splicing it out of `blob.properties`, not
  setting `property.value = null`.
- **Anything that changes encoded byte count requires `_recomputeSizes = true`.**
  Lengthening an FString, adding an array element, swapping a known-
  binary struct for a propStream — any of these without recompute leaves
  every dependent `tag.size` stale, and Soulmask's reader will walk off
  the end of the value into the next property's bytes. Symptom: edited
  blob loads but with reset/missing fields downstream of the edit.
- The JSON pipeline (`jsonToBlob`, `jsonStringToBlob`) sets this for you.
- `serialize()` throws if `_dirty` is true AND `error` is set:
  re-emitting from an empty properties array would produce a malformed
  stream. Leave `_dirty = false` to pass through `_raw` verbatim, or
  clear `.error` first if you've replaced `.properties` manually.
- 64-bit integer values (`Int64Property`, `UInt64Property`,
  `DateTime`, `Timespan`) round-trip as decimal strings. If you
  replace such a value with a Number, it must be a safe integer
  (`|v| <= Number.MAX_SAFE_INTEGER`); otherwise the writer throws
  rather than silently lose precision.

`serialize()` is byte-identical to a fresh `decode + serialize` cycle
on its output, verified on every row of the tested `world.db`. With
recompute enabled the encoder may produce shorter bytes than the
original when the wire's `tag.size` over-stated the actual value byte
count (some Soulmask Maps do this); the bytes still decode to the same
object tree, and tested in-game loads accept both forms.

## LZ4 integration

`actor_data` column bytes come out of LZ4 compression. wscodec
doesn't bundle an LZ4 implementation; that's a caller concern. A
working recipe using `lz4-wasm-nodejs`:

```js
import Database from 'better-sqlite3';
import * as lz4 from 'lz4-wasm-nodejs';
import { UnrealBlob } from 'wscodec';

const OUTER_VERSION_TAG = 0x00000002;
const OUTER_HEADER_SIZE = 4;

function decodeColumnBytes(u8) {
  // Sniff the outer version tag.
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.length < OUTER_HEADER_SIZE + 4 || dv.getUint32(0, true) !== OUTER_VERSION_TAG) {
    throw new Error('Not a Soulmask actor_data blob');
  }
  // LZ4 block starts right after the version tag.
  const inner = lz4.decompress(u8.subarray(OUTER_HEADER_SIZE));
  return UnrealBlob.decode(inner);
}

function encodeBlob(blob) {
  const inner = blob.serialize();
  const compressed = lz4.compress(inner);
  const out = new Uint8Array(OUTER_HEADER_SIZE + compressed.length);
  new DataView(out.buffer).setUint32(0, OUTER_VERSION_TAG, true);
  out.set(compressed, OUTER_HEADER_SIZE);
  return out;
}

const db = new Database('./world.db', { readonly: true });
for (const row of db.prepare('SELECT actor_serial, actor_data FROM actor_table').all()) {
  const blob = decodeColumnBytes(new Uint8Array(row.actor_data));
  console.log(row.actor_serial, blob.properties.length, 'properties');
}
```

Note: LZ4 compression is not deterministic. Two compressors will
produce different bytes for the same input. wscodec's byte-identical
guarantee covers the inner property-stream bytes; the outer column
bytes round-trip only for unmodified blobs (cache the input column
bytes if you need that).

## Round-trip guarantees

For every row in the tested `world.db`:

- `UnrealBlob.decode(inner)` succeeds without `error` set and produces zero `OpaqueValue` entries (every property type decodes structurally).
- `blob.serialize()` with `_dirty = false` returns the input bytes byte-identical (pass-through).
- `blob.serialize()` with `_dirty = true` and `_recomputeSizes = false` re-emits from `properties` and is byte-identical to the input.
- `blob.serialize()` with `_dirty = true` and `_recomputeSizes = true` (the JSON-pipeline default) re-emits with `tag.size` rewritten from the actual value byte count. Decoding the result yields the same property tree as the input; the wire bytes may differ where the input's stored sizes over-stated the actual value byte count (some Soulmask Maps do this).
- The same `UnrealBlob` going through `blobToJSON` → `jsonToBlob` → `serialize` yields bytes that decode to the same tree as the input.

Coverage includes every known Soulmask wire-format quirk:

- **kind=0x01 ObjectProperty with the 4-byte actor-ref prefix.**
  Soulmask's hard actor references (a pawn pointing at its inventory
  actor, for example) prepend an extra 4-byte field between the kind
  byte and the path FString. Observed value is always 1; semantic is
  unknown but the bytes are captured and replayed verbatim.
- **Embedded ObjectProperty streams with the 4-byte FName.Number trailer.**
  Some Soulmask nested ObjectProperty values (`JianZhuInstGLQComponent`
  is the canonical example; `JianZhu` = "building") carry the
  outermost-stream None trailer (a 4-byte FName.Number = 0) after their
  embedded property stream, where stock UE 4.27 nested streams do not.
- **ArrayProperty<ObjectProperty> with per-element placement-binary blocks.**
  `JianZhuInstYuanXings` arrays (`YuanXing` = "prototype", so
  "building-zone yuan-xing" is the list of building-piece prototypes
  inside a building zone) interleave a fixed-shape binary block after
  each ObjectProperty element. The codec decodes the block structurally
  into `{ transforms: [[16 floats], …], ids: [u32, …], aux: [[16 floats], …] }`.
  The transforms are row-major UE `FMatrix`-style 4×4 matrices; the
  translation lives at indices 12, 13, 14. Non-canonical NaN bit
  patterns (observed `0xFFFFFFFF` as a sentinel in aux data) are
  preserved via `{ $nanBits: u32 }` wrappers, because JS `Number`
  collapses all NaNs to `0x7FC00000`. In-game testing confirms Soulmask
  renders building pieces from their `RelativeTransform` property (a
  `StructProperty<Transform>` in `MapInstJianZhuDataList`); the
  per-element trailings carry the same data as a render-side cache, so
  edits that move pieces must update both.
- **ArrayProperty<TextProperty> with mixed FText history types.**
  Elements use history types -1 (culture-invariant), 0 (localized),
  1 (`FTextHistory_NamedFormat` — a format pattern plus a
  `TMap<FString, FFormatArgumentValue>` of named arguments), 2
  (ordered format), and 4 (`FTextHistory_AsNumber`). History type 4
  embeds a legacy UE3-style `FNumberFormattingOptions` whose boolean
  fields are 4 bytes wide rather than the modern 1 byte; the codec
  emits this correctly.
- **SetProperty<StructProperty> with implicit FGuid struct keys.**
  Soulmask `SetProperty` declarations whose inner is `StructProperty`
  don't carry an inner struct shape; every populated instance in
  `world.db` uses raw 16-byte FGuids as elements.
- **Custom Soulmask Map<Struct,Struct> framing.** The guild-data maps
  (`GongHuiMap`, `PlayerGongHuiDataMap`; `GongHui` = "guild") use a
  non-standard layout. The map's tag.size lies (observed 632838 vs
  actual 636422); pair shapes are detected by peeking at the next
  bytes rather than trusting the declared size.

## Running the tests

```sh
git clone https://github.com/auroris/SoulmaskCodec.git
cd SoulmaskCodec
npm install

# Byte-identical roundtrip across every row of a world.db.
npm test                                  # looks for world.db two dirs up by default
node test/test-roundtrip.mjs /path/to/world.db

# JSON-pipeline roundtrip. Encodes both sides with recomputeSizes=true
# and compares; verifies blobToJSON ↔ jsonToBlob is lossless.
npm run test:json -- /path/to/world.db
npm run test:json-spot -- /path/to/world.db   # spot-check on rows that exercise each code path
```

Test deps: `lz4-wasm-nodejs` (LZ4 inside the test) and
`better-sqlite3` (reads the `world.db` SQLite file). Both are picked
up via npm module resolution; if `better-sqlite3` isn't installed at
the package root the tests will surface that with a clear error. See
the Setup section above for the build-tools prerequisite on Windows.

## Bundled scripts

The repo also ships full db ↔ JSON utilities under [scripts/](scripts/).
These are NOT shipped in the npm package (the codec stays zero-dep); they
live in the repo as reference workflows.

```sh
# Dump every row of a world.db (LZ4-decompressing actor_data and decoding
# through wscodec where possible) to a single JSON file.
npm run export-db -- /path/to/world.db world.json

# Inverse: rebuild a SQLite db from the JSON export. The npm script
# already runs node with --max-old-space-size=4096 (necessary for
# multi-hundred-MB exports).
npm run import-db -- world.json /path/to/new.db

# Diff two world.db files at the uncompressed level (tolerates LZ4 re-compression).
node scripts/diff-dbs.mjs a.db b.db

# Search every decoded blob for a substring (custom names, UIDs, asset paths).
node scripts/find-string.mjs /path/to/world.db "Claude's Chest"

# Pretty-print one actor's full property tree.
node scripts/dump-actor.mjs /path/to/world.db <actor_serial> [out.json]

# Merge every workbench access log, NPC work log, and clan log into a single
# timestamp-sorted .log file. .NET ticks → ISO-8601 UTC; FText placeholders
# substituted into their NamedFormat / OrderedFormat templates.
npm run dump-logs -- /path/to/world.db world.log
```

The export/import pair has been validated end-to-end against Soulmask
itself: a full db → JSON → db round-trip produces a save that the game
loads cleanly. See [docs/helpers-handoff.md](docs/helpers-handoff.md)
for notes on building a higher-level save-edit helper library on top of
the codec.

## License

MIT.
