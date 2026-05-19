#!/usr/bin/env node
/**
 * Apply a NamedFormat-FText (historyType=1) edit to one of the Egyptian-Exile
 * NPCs' camp logs, then write the result to a new JSON.
 *
 *   node --max-old-space-size=4096 scripts/test-edit-npc-log.mjs <in.json> <out.json>
 *
 * Target: actor_serial=307 (BP_EgyptDLC_Exiles_F_C). We scan JingYingRiZhiList
 * for the first element whose ParamArrayTxt contains a NamedFormat FText
 * (sourceFmt "X={X} Y={Y} Z={Z}" with named arguments X/Y/Z). The index drifts
 * as the NPC's log grows over playtime, so we don't hard-code it. We change
 * the sourceFmt's sourceString and ALSO blank its namespace/key so the engine
 * can't fall back to the localized version and is forced to render the
 * (modified) sourceString.
 *
 * In-game expectations:
 *   - Open NPC #307's camp log (Egyptian Exile female, on the DLC island).
 *   - Log entry 46's coordinate line should now read approximately
 *     "WSCODEC X=<num> Y=<num> Z=<num>" instead of the original
 *     "X=<num> Y=<num> Z=<num>".
 *   - If you see the original text instead, the localization table is
 *     overriding via a non-empty namespace/key fallback; check the JSON
 *     to confirm the sourceFmt fields actually got set.
 *
 * This exercises:
 *   - FText historyType=1 (NamedFormat) read+write
 *   - Nested FText (sourceFmt is historyType=0 inside an outer historyType=1)
 *   - Array<TextProperty> elements with mixed history types
 */

import fs from 'node:fs';

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error('Usage: node scripts/test-edit-npc-log.mjs <in.json> <out.json>');
  process.exit(1);
}

const j = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const rows = j.tables.actor_table.rows;

const npc = rows.find(r => r.actor_serial === 307);
if (!npc) { console.error('NPC 307 not found'); process.exit(1); }

// Also teleport her to Claude's Cabinet's coordinates so the user can find her.
// The chest is on Ship_03; the NPC will spawn on the deck next to it. The
// actor_transf column is plain TEXT (outside the wscodec blob) — this edit
// doesn't exercise the codec, it's just so the test has a visible target.
const chest = rows.find(r => r.actor_serial === 43299);
if (chest) {
  console.log('NPC 307 actor_transf:');
  console.log('  before: ' + npc.actor_transf);
  // Parse the chest's transform: "tx,ty,tz|pitch,yaw,roll|sx,sy,sz".
  // Take its translation, keep the NPC's own rotation+scale.
  const [chestTrans] = chest.actor_transf.split('|');
  const [, npcRot, npcScale] = npc.actor_transf.split('|');
  // Bump z by 200 (2m) so she spawns above the chest, not inside it.
  const parts = chestTrans.split(',').map(Number);
  parts[2] += 200;
  npc.actor_transf = parts.join(',') + '|' + npcRot + '|' + npcScale;
  console.log('  after:  ' + npc.actor_transf);
} else {
  console.warn('chest (43299) not found; leaving NPC 307 at original position');
}

function findProp(props, name) {
  return props.find(p => p.tag.name === name);
}

// Find the JingYingRiZhiList property at any depth. It lives on the NPC's
// top-level properties OR in an embedded component. Try top-level first.
let list = findProp(npc.actor_data.blob.properties, 'JingYingRiZhiList');
if (!list) {
  // Walk embedded components.
  for (const p of npc.actor_data.blob.properties) {
    const v = p.value;
    if (v?.embedded) {
      const hit = findProp(v.embedded, 'JingYingRiZhiList');
      if (hit) { list = hit; break; }
    }
  }
}
if (!list) { console.error('JingYingRiZhiList not found on NPC 307'); process.exit(1); }

// Each element is a StructProperty propStream with a ParamArrayTxt field
// (ArrayProperty<TextProperty>). Scan for the first NamedFormat FText —
// the index drifts as the NPC's log grows during play.
let foundI = -1, foundJ = -1, target = null;
for (let i = 0; i < list.value.elements.length; i++) {
  const e = list.value.elements[i];
  const pat = findProp(e.properties, 'ParamArrayTxt');
  if (!pat) continue;
  for (let k = 0; k < pat.value.elements.length; k++) {
    const el = pat.value.elements[k];
    if (el?.historyType === 1) { foundI = i; foundJ = k; target = el; break; }
  }
  if (target) break;
}
if (!target) { console.error('no NamedFormat FText found in NPC 307 camp log'); process.exit(1); }
console.log(`Target: JingYingRiZhiList[${foundI}].ParamArrayTxt[${foundJ}]`);

const fmt = target.sourceFmt;
console.log('Before:');
console.log('  historyType=1 sourceFmt:');
console.log('    namespace    = ' + JSON.stringify(fmt.namespace));
console.log('    key          = ' + JSON.stringify(fmt.key));
console.log('    sourceString = ' + JSON.stringify(fmt.sourceString));
console.log('  arg keys: ' + target.arguments.map(a => a.key).join(', '));

// Force the engine to render OUR sourceString by clearing the localization
// lookup keys. Soulmask's text resolution falls back from (namespace, key)
// to sourceString when the lookup misses.
fmt.namespace    = '';
fmt.key          = '';
fmt.sourceString = 'WSCODEC X={X} Y={Y} Z={Z}';

console.log('After:');
console.log('  sourceString = ' + JSON.stringify(fmt.sourceString));
console.log('  namespace+key cleared');

fs.writeFileSync(outPath, JSON.stringify(j));
console.log('\nwrote ' + outPath);
console.log('Next: node --max-old-space-size=4096 scripts/json-to-db.mjs ' + outPath + ' world-test.db');
