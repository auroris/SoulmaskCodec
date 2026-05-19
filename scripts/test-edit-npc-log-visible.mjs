#!/usr/bin/env node
/**
 * Visible test on NPC 307's work log: change the MOST RECENT entry's
 * inline placeholder so the work-log UI shows our test string at the
 * top of the list.
 *
 *   node --max-old-space-size=4096 scripts/test-edit-npc-log-visible.mjs <in.json> <out.json>
 *
 * The NPC's JingYingRiZhiList[99] (newest entry) has a single
 * ParamArrayTxt[0] FText with historyType=0:
 *   namespace = ""
 *   key       = "<localization hash>"
 *   sourceString = "小型挖掘场"   (renders as "Minor Mining Site")
 *
 * We change the sourceString to a custom marker and blank the key so the
 * engine can't find a localized translation and is forced to render the
 * literal sourceString. The work-log UI line should change from
 *   "Go collect resources in <Minor Mining Site>."
 * to
 *   "Go collect resources in <EDITED BY WSCODEC>."
 */

import fs from 'node:fs';

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error('Usage: node scripts/test-edit-npc-log-visible.mjs <in.json> <out.json>');
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const rows = j.tables.actor_table.rows;
const npc = rows.find(r => r.actor_serial === 307);
if (!npc) { console.error('NPC 307 not found'); process.exit(1); }

function findProp(props, name) { return props.find(p => p.tag.name === name); }
let list = findProp(npc.actor_data.blob.properties, 'JingYingRiZhiList');
if (!list) for (const p of npc.actor_data.blob.properties) if (p.value?.embedded) {
  const hit = findProp(p.value.embedded, 'JingYingRiZhiList');
  if (hit) { list = hit; break; }
}
if (!list) { console.error('JingYingRiZhiList not found'); process.exit(1); }

const lastIdx = list.value.elements.length - 1;
const last = list.value.elements[lastIdx];
const pat = findProp(last.properties, 'ParamArrayTxt');
if (!pat) { console.error('ParamArrayTxt not found on last entry'); process.exit(1); }
const el = pat.value.elements[0];
if (!el || el.historyType !== 0) {
  console.error(`expected most-recent entry's ParamArrayTxt[0] to be historyType=0; got ${el?.historyType}`);
  process.exit(1);
}

console.log(`Target: JingYingRiZhiList[${lastIdx}].ParamArrayTxt[0]`);
console.log('Before:');
console.log('  namespace    =', JSON.stringify(el.namespace));
console.log('  key          =', JSON.stringify(el.key));
console.log('  sourceString =', JSON.stringify(el.sourceString));

el.namespace = '';
el.key = '';
el.sourceString = 'EDITED BY WSCODEC';

console.log('After:');
console.log('  sourceString =', JSON.stringify(el.sourceString));
console.log('  namespace+key cleared');

fs.writeFileSync(outPath, JSON.stringify(j));
console.log('\nwrote ' + outPath);
