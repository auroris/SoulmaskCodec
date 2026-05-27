#!/usr/bin/env node
/**
 * Bundle the src/ ES modules into dist/ for non-bundler consumers.
 *
 *   dist/wscodec.mjs / .global.js / .cjs               the codec
 *   dist/wscodec-translations.mjs / .global.js / .cjs  the name lookups
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

const bundles = [
  { entry: 'src/wscodec.mjs',      base: 'wscodec',              global: 'wscodec' },
  { entry: 'src/translations.mjs', base: 'wscodec-translations', global: 'wscodecTranslations' },
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
