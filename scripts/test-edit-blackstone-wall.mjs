#!/usr/bin/env node
/**
 * perElementTrailings test: move one wall of the user's blackstone house.
 *
 *   node --max-old-space-size=4096 scripts/test-edit-blackstone-wall.mjs <in.json> <out.json>
 *
 * Target: actor_serial=43317 (JianZhuPianQu near the "Blackstone House"
 * iron pit bonfire). Inside its JianZhuInstGLQComponent's embedded stream,
 * JianZhuInstYuanXings has 5 prototype groups; group [1] is the 5 walls.
 * We shift piece 0's translation by +500 along local X (~5m). UE's FMatrix
 * stores world transforms row-major; the translation is M[3][0..2], i.e.
 * indices 12, 13, 14 in the flat 16-float array.
 *
 * In-game expectations:
 *   - Reload Manual Save 1. You'll be standing inside the house.
 *   - One specific wall has slid ~5m to one side, leaving a visible gap in
 *     the structure. The other 4 walls + foundation + roof + door stay put.
 *
 * This validates the decoder's interpretation of:
 *   - Row-major 16-float FMatrix layout
 *   - Per-element trailing block structure (header, 3 sections, strides 64/4/64)
 *   - Section 0 (transforms) bit-for-bit round-trip including any
 *     non-canonical NaN bit patterns
 */

import fs from 'node:fs';

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error('Usage: node scripts/test-edit-blackstone-wall.mjs <in.json> <out.json>');
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const zone = j.tables.actor_table.rows.find(r => r.actor_serial === 43317);
if (!zone) { console.error('building zone 43317 not found'); process.exit(1); }

const findP = (ps, n) => ps.find(p => p.tag.name === n);
const glq = findP(zone.actor_data.blob.properties, 'JianZhuInstGLQComponent');
const yuan = findP(glq.value.embedded, 'JianZhuInstYuanXings');
const wallGroup = 1;
const wallPiece = 0;
const trailing = yuan.value.perElementTrailings[wallGroup];
if (!trailing) { console.error(`no perElementTrailings for group [${wallGroup}]`); process.exit(1); }

const m = trailing.transforms[wallPiece];
const ml = findP(yuan.value.elements[wallGroup].embedded, 'MapInstJianZhuDataList');
const rtEntry = ml.value.entries[wallPiece];
const rt = rtEntry.value.properties.find(p => p.tag.name === 'RelativeTransform');
const trans = rt.value.properties.find(p => p.tag.name === 'Translation').value.value;

console.log(`Target: zone 43317 -> walls group, piece ${wallPiece}`);
console.log(`Before: perElementTrailings transform[12..14] = (${m[12].toFixed(2)}, ${m[13].toFixed(2)}, ${m[14].toFixed(2)})`);
console.log(`Before: MapInstJianZhuDataList[${wallPiece}].RelativeTransform.Translation = (${trans.x.toFixed(2)}, ${trans.y.toFixed(2)}, ${trans.z.toFixed(2)})`);

// Soulmask renders from RelativeTransform; perElementTrailings is a derived
// cache that the game doesn't regenerate on save. To avoid orphan drift from
// previous experiments, sync both transforms to RelativeTransform first, then
// apply the shift on top of that baseline.
const newX = trans.x + 500;
trans.x = newX;
m[12]  = newX;
m[13]  = trans.y;
m[14]  = trans.z;

console.log(`After:  perElementTrailings = (${m[12].toFixed(2)}, ${m[13].toFixed(2)}, ${m[14].toFixed(2)})`);
console.log(`After:  RelativeTransform   = (${trans.x.toFixed(2)}, ${trans.y.toFixed(2)}, ${trans.z.toFixed(2)})`);
console.log('(both transforms now agree, shifted +500 along zone-local X from RelativeTransform baseline)');

fs.writeFileSync(outPath, JSON.stringify(j));
console.log('\nwrote ' + outPath);
