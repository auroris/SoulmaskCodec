# wscodec

Pure-JS codec for Soulmask `actor_data` property streams. Zero runtime
dependencies. Accepts uncompressed bytes, returns JS objects, and vice
versa. Round-trip byte-identical against every actor in the test corpus.

The wire format is UE 4.27 `FPropertyTag` with Soulmask-specific quirks
(see [`docs/blob.md`](docs/blob.md) for the wire layout and
[`docs/properties/object.md`](docs/properties/object.md) for the
ObjectProperty variations).

## Install

```bash
npm install wscodec
```

Targets modern browsers and Node 20+. Browser is the primary runtime; the
bundled `scripts/` and `test/` directories assume Node.

## Quick start

```js
import { UnrealBlob } from 'wscodec';

// `bytes` is an uncompressed property-stream Uint8Array. If you're reading
// Soulmask's actor_data column directly, LZ4-decompress it first; see
// "Scope" below.
const blob = UnrealBlob.fromBytes(bytes);

// Read a top-level property.
const owner = blob.findProperty('PCOwnerGuid');
console.log(owner?.value);

// Walk into nested streams (embedded ObjectRef, StructValue, etc.).
const slot = blob.findPropertyDeep('SlotIndex');

// Re-encode after editing.
const out = blob.toBytes();
```

## JSON form

Every decoded value has a structured JSON form, useful for diffing,
editing in another tool, or round-tripping through a database.

```js
const json = blob.toJSONString(2);     // string; preserves -0 / NaN / Infinity
const back = UnrealBlob.fromJSONString(json);
back.toBytes();                        // byte-identical to bytes above
```

`jsonReplacer` / `jsonReviver` are also exported separately so you can
embed a wscodec JSON tree inside a larger `JSON.stringify` envelope.

## Strict mode

By default, anything the codec can't fully decode (unknown property type,
unimplemented FText history type, in-container decode failures) is
captured as opaque bytes and surfaced via `console.warn`. Pass
`{ strict: true }` to throw instead:

```js
UnrealBlob.fromBytes(bytes, { strict: true });
```

Use strict mode in tests and tooling. Use the default in apps that need
to display whatever they can.

## Browser usage

Pre-built bundles ship under `dist/`:

- `dist/wscodec.mjs`        - ESM, for `<script type="module">` / ESM CDNs
- `dist/wscodec.global.js`  - IIFE; exposes `window.wscodec`
- `dist/wscodec.cjs`        - CommonJS, for `require()`

Bundler users should import from `wscodec` directly (per the
`package.json` `exports` map) so tree-shaking works.

## Translations

The optional `wscodec/translations` subpath export resolves Soulmask
class names, object paths, and numeric IDs to English display names.
Zero dependencies, opt-in:

```js
import { item, npc, translate } from 'wscodec/translations';

item('/Game/Blueprints/DaoJu/.../BP_WuQi_Dao_2.BP_WuQi_Dao_2_C'); // 'Beast Bone Blade'
npc('BP_DongWu_Base_C');
translate(100011, 'gifts');                                        // 'Swift Pace'
```

Tables are generated from the game's CSV export by
`scripts/build-translations.mjs`; regenerate after a game patch.

## Scope

This library handles the UE 4.27 `FPropertyTag` wire format on
**uncompressed** bytes. It does NOT bundle:

- **LZ4** - Soulmask's `actor_data` column wraps the property stream in
  an LZ4 block. Decompress with `lz4-wasm-nodejs` (Node) or
  `lz4js`/similar (browser) before calling `UnrealBlob.fromBytes`.
- **SQLite** - readers like `better-sqlite3` (Node) or `sql.js` (browser)
  pull rows from `world.db`.

This boundary is deliberate: LZ4 output is not deterministic across
compressors, so isolating it keeps the codec's byte-identical guarantee
meaningful at the property-stream layer.

## API reference

Generated from JSDoc comments in `src/`. See
[`docs/README.md`](docs/README.md) for the module index, then drill into
individual modules:

- [`UnrealBlob`, `codec`, `jsonReplacer`/`jsonReviver`](docs/blob.md) -
  top-level entry point
- [`Cursor`, `Writer`](docs/io.md) - byte-level primitives
- [`FName`, `FGuid`](docs/primitives.md) - identifier types
- [`PropertyTag`](docs/tag.md), [`PropertyStream`](docs/property-stream.md),
  [`Property`](docs/property.md) - decode/encode machinery
- [`properties/`](docs/) - one file per property class

Regenerate the docs after editing JSDoc with:

```bash
npm run build-docs
```

`npm run build` rebuilds both the `dist/` bundles and the `docs/` tree.

## Development

```bash
npm install
npm test               # round-trip + JSON-roundtrip suites
npm run build          # dist/ bundles + docs/ markdown
npm run build-docs     # docs only
```

A 174.6 MB test world (11,667 rows) round-trips byte-identically; see
`test/run-all.mjs`.

## Repository

[github.com/auroris/SoulmaskCodec](https://github.com/auroris/SoulmaskCodec)

## License

MIT
