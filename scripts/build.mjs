#!/usr/bin/env node
/**
 * Bundle the src/ ES modules into dist/ for non-bundler consumers, then
 * regenerate the Markdown docs from JSDoc comments.
 *
 *   dist/wscodec.mjs / .global.js / .cjs               the codec
 *   dist/wscodec-translations.mjs / .global.js / .cjs  the name lookups
 *   docs/<src tree mirror>.md                          jsdoc -> markdown
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
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
console.log('bundle complete');

// Regenerate the API docs from JSDoc. Spawn a child process so the
// jsdoc-to-markdown library's logging and the bundle output don't tangle.
const docsScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-docs.mjs');
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [docsScript], { stdio: 'inherit' });
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`build-docs exited ${code}`)));
});

console.log('build complete');
