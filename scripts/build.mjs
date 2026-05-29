#!/usr/bin/env node
/**
 * Bundle the src/ ES modules into dist/ for non-bundler consumers.
 *
 *   dist/wscodec.mjs / .global.js / .cjs                  the codec
 *   dist/wscodec-translations.core.mjs / ...              the lookup factory
 *   dist/wscodec-translations.<lang>.mjs / ...            per-language lookups
 *
 * Each entry is built three ways:
 *   .mjs        bundled ESM  - <script type="module"> / ESM CDN
 *   .global.js  IIFE global  - classic <script> (window.wscodec / .wscodecTranslations)
 *   .cjs        bundled CJS  - require()
 *
 * Bundler users import the src/ ESM directly (see package.json "exports"),
 * which tree-shakes; these bundles exist for everyone else. Run via
 * `npm run build`; also runs automatically before `npm publish`.
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';

// Per-language wrappers: src/translations.<lang>.mjs (two-letter code), minus
// the locale-neutral core and the generated translations.data.<lang>.mjs files.
const langs = fs.readdirSync('src')
  .map(f => f.match(/^translations\.([a-z]{2})\.mjs$/))
  .filter(Boolean)
  .map(m => m[1])
  .sort();

const bundles = [
  { entry: 'src/wscodec.mjs',           base: 'wscodec',                   global: 'wscodec' },
  { entry: 'src/translations.core.mjs', base: 'wscodec-translations.core', global: 'wscodecTranslationsCore' },
  ...langs.map(l => ({
    entry: `src/translations.${l}.mjs`,
    base: `wscodec-translations.${l}`,
    global: 'wscodecTranslations',
  })),
];

const formats = [
  { format: 'esm',  ext: 'mjs',       platform: 'browser', minify: true  },
  { format: 'iife', ext: 'global.js', platform: 'browser', minify: true  },
  { format: 'cjs',  ext: 'cjs',       platform: 'node',    minify: false },
];

for (const b of bundles) {
  for (const f of formats) {
    const outfile = `dist/${b.base}.${f.ext}`;
    await esbuild.build({
      entryPoints: [b.entry],
      bundle: true,
      format: f.format,
      platform: f.platform,
      minify: f.minify,
      globalName: f.format === 'iife' ? b.global : undefined,
      target: ['es2020'],
      sourcemap: true,
      outfile,
    });
    console.log(`  ${outfile}`);
  }
}
console.log('build complete');
