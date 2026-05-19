# wscodec

Pure-JS codec for Soulmask `actor_data` property streams — the binary
payload UE 4.27 emits for every actor's serialized state, with the
Soulmask-specific quirks layered on top.

Zero runtime dependencies. Accepts uncompressed bytes, returns
JavaScript objects, and vice versa. Round-trip is byte-identical
against every actor in a tested `world.db` (174.6 MB across 11,667
rows; `npm test`).

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
decompression). The caller handles LZ4 — see "LZ4 integration" below
for a copy-paste recipe with `lz4-wasm-nodejs`.

The SQLite `actor_table.data_version` column stores the NEGATIVE of
the on-wire DataVersion. A healthy blob with wire `DataVersion=2`
lives in a row whose `data_version` column reads `-2`. The wire
bytes themselves are always the unsigned `0x00000002`.

## Install

```sh
npm install wscodec
```

## API

### Top-level

```js
import { UnrealBlob } from 'wscodec';

const blob = UnrealBlob.decode(uncompressedBytes); // Uint8Array → blob
const bytes = blob.serialize();                    // blob → Uint8Array
UnrealBlob.detect(u8);                              // sniff version tag → boolean
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

`blob.serialize()` returns a `Uint8Array`. When `_dirty` is false it
returns `_raw` verbatim (byte-identical pass-through). When `_dirty`
is true it re-emits the property stream from `properties` via
`writePropertyStream`.

`blob.findProperty(name)` returns the first top-level property whose
tag name matches, or `null`.

### Property tree

`blob.properties` is an array of `Property` instances. Each carries
a `PropertyTag` (`name`, `type`, `size`, …) and a `value` whose
JavaScript shape depends on the tag's type:

| tag type | value shape |
|---|---|
| `IntProperty`, `FloatProperty`, `BoolProperty`, … | plain JS primitive |
| `StrProperty`, `NameProperty` | string / `FName` |
| `StructProperty` | `StructValue` — `.value` is either a plain object (known binary structs like `Vector`, `Quat`, `Transform`, `Guid`, …) or a nested property array |
| `ArrayProperty`, `SetProperty` | `ArrayValue` / `SetValue` with `.elements` |
| `MapProperty` | `MapValue` with `.entries: [[key, value], …]` |
| `ObjectProperty`, `ClassProperty`, `Weak*`, `Lazy*`, `WSObjectProperty` | `ObjectRef` (kind + optional path/classPath/embedded stream) |
| `SoftObjectProperty`, `SoftClassProperty` | `SoftObjectRef` (`assetPath`, `subPath`) |
| `TextProperty` | `FTextValue` (handles UE4 FText history types -1, 0, 2, 4) |
| anything wscodec couldn't structurally decode | `OpaqueValue` — bytes retained verbatim |

Submodule re-exports make the value classes importable directly:

```js
import { ObjectRef, SoftObjectRef, FTextValue, OpaqueValue, StructValue } from 'wscodec';
import { PropertyTag, ArrayValue, SetValue, MapValue } from 'wscodec';
import { FName, FGuid } from 'wscodec';
```

Lower-level helpers (`Cursor`, `Writer`, `readPropertyStream`,
`writePropertyStream`, `readValue`, `writeValue`, `STRUCT_HANDLERS`)
are also exported for callers building custom workflows on top.

### Editing

```js
import { UnrealBlob } from 'wscodec';

const blob = UnrealBlob.decode(inner);

// Mutate the tree directly. The library does not provide typed
// mutators; callers manipulate `properties` and set `_dirty` to
// force re-encode.
blob.findProperty('JianZhuHP').value = 100;
blob._dirty = true;

const updatedBytes = blob.serialize(); // re-emits from properties
```

`serialize()` for a dirty blob is byte-identical to a fresh
`decode + serialize` cycle on its output — verified on every row
of the tested `world.db`.

## LZ4 integration

`actor_data` column bytes come out of LZ4 compression. wscodec
doesn't bundle an LZ4 implementation — that's a caller concern. A
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

Note: LZ4 compression is not deterministic — two compressors will
produce different bytes for the same input. wscodec's
byte-identical guarantee covers the inner property-stream bytes;
the outer column bytes round-trip only for unmodified blobs (cache
the input column bytes if you need that).

## Round-trip guarantees

For every row in the tested `world.db`:

- `UnrealBlob.decode(inner)` succeeds without `error` set.
- `blob.serialize()` with `_dirty = false` returns the input bytes byte-identical.
- `blob.serialize()` with `_dirty = true` re-emits from `properties` and is byte-identical to the input.

Coverage: 174,610,207 bytes across 11,667 actors, including every
known Soulmask wire-format quirk:

- `kind=0x01` ObjectProperty with the 4-byte actor-ref prefix.
- Embedded ObjectProperty streams with the 4-byte FName.Number trailer
  (the Soulmask `JianZhuInstGLQComponent`-style nested format).
- ArrayProperty<ObjectProperty> with the JianZhuInstYuanXings
  per-element placement-binary blocks (8-byte header + three
  stride/count sections per yuan-xing prototype).
- ArrayProperty<TextProperty> elements with FText history types
  -1, 0, 2, and 4 (including the legacy UE3-style uint32 booleans in
  FNumberFormattingOptions).
- SetProperty<StructProperty> with implicit FGuid struct keys.
- Custom Soulmask Map<Struct,Struct> framing.

## Running the test

```sh
git clone …                # repo with world.db at the root
cd repo/wscodec
npm install
npm test                    # looks for world.db two dirs up by default
# or
node test/test-roundtrip.mjs /path/to/world.db
```

Test deps: `lz4-wasm-nodejs` (LZ4 inside the test), `better-sqlite3`
(reads the `world.db` SQLite file). Both are picked up via npm
module resolution; if `better-sqlite3` isn't installed at the package
root the test will surface that with a clear error.

## License

MIT.
