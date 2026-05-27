#!/usr/bin/env node
/**
 * Generate Markdown API docs from JSDoc comments in `src/`.
 *
 * Walks the source tree, runs `jsdoc-to-markdown` on each `.mjs` file, and
 * writes the result to a matching path under `docs/`. The generated
 * `docs/README.md` is a flat index linking to each module file.
 *
 * Source files that produce no JSDoc output (e.g. pure re-export entry
 * points, generated data tables) are skipped from the index but still
 * written as empty stubs.
 *
 * Run via `npm run build-docs`; also runs as part of `npm run build`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdoc2md from 'jsdoc-to-markdown';

const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR  = path.join(ROOT, 'src');
const DOCS_DIR = path.join(ROOT, 'docs');
const JSDOC_CONFIG = path.join(ROOT, 'jsdoc.json');

async function walk(dir) {
  const out = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walk(full));
    else if (ent.isFile() && full.endsWith('.mjs')) out.push(full);
  }
  return out;
}

const files = (await walk(SRC_DIR)).sort();

await fs.rm(DOCS_DIR, { recursive: true, force: true });
await fs.mkdir(DOCS_DIR, { recursive: true });

const index = [];

for (const src of files) {
  const rel    = path.relative(SRC_DIR, src).replace(/\\/g, '/');
  const outRel = rel.replace(/\.mjs$/, '.md');
  const outAbs = path.join(DOCS_DIR, outRel);
  await fs.mkdir(path.dirname(outAbs), { recursive: true });

  const md = await jsdoc2md.render({
    files: src,
    configure: JSDOC_CONFIG,
    'no-cache': true,
  });

  const body = md.trim();
  const title = `wscodec/${rel.replace(/\.mjs$/, '')}`;
  const header = `# ${title}\n\nSource: [\`src/${rel}\`](../src/${rel})\n\n`;
  await fs.writeFile(outAbs, header + (body || '_No documented exports._') + '\n');

  if (body) index.push({ title, outRel });
  console.log(`  docs/${outRel}`);
}

const indexLines = [
  '# wscodec API reference',
  '',
  'Generated from JSDoc comments in `src/`. Regenerate with `npm run build-docs`.',
  '',
  '## Modules',
  '',
  ...index.map(({ title, outRel }) => `- [${title}](${outRel})`),
  '',
];
await fs.writeFile(path.join(DOCS_DIR, 'README.md'), indexLines.join('\n'));
console.log(`  docs/README.md`);
console.log('docs build complete');
