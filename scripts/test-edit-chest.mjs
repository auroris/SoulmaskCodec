#!/usr/bin/env node
/**
 * Apply a set of test edits to "Claude's Chest" (actor_serial=43299) and its
 * bound inventory actor (actor_serial=43298) in a world.json export, then
 * write the result to a new JSON.
 *
 *   node --max-old-space-size=4096 scripts/test-edit-chest.mjs <in.json> <out.json>
 *
 * Edits applied:
 *   1. Chest display name "Claude's Chest" -> "Claude's Cabinet"
 *      (tests FText historyType=-1 displayString round-trip)
 *   2. Iron ingot stack count: 5 -> 99
 *      (tests ObjectRef.embedded + nested IntProperty)
 *   3. Access-log row: count 5 -> 99, operator "Aleena" -> "AutoTest"
 *      (tests ArrayProperty<StructProperty> + nested FText + DateTime survival)
 *
 * After running this, do:
 *   node --max-old-space-size=4096 scripts/json-to-db.mjs <out.json> world-test.db
 * and drop world-test.db into your save folder (rename to world_mannual_1.db,
 * back up the original first). In-game expectations:
 *   - Chest name shows "Claude's Cabinet" on hover/UI.
 *   - Opening the chest shows 99 Iron Ingots instead of 5.
 *   - The access log entry reads "AutoTest deposited Iron Ingot x99".
 */

import fs from 'node:fs';

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error('Usage: node scripts/test-edit-chest.mjs <in.json> <out.json>');
  process.exit(1);
}

const j = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const rows = j.tables.actor_table.rows;

function findRow(serial) {
  const r = rows.find(r => r.actor_serial === serial);
  if (!r) { console.error(`row not found: serial=${serial}`); process.exit(1); }
  return r;
}
function findProp(props, name) {
  const p = props.find(p => p.tag.name === name);
  if (!p) { console.error(`property not found: ${name}`); process.exit(1); }
  return p;
}

// ── Edit 1: chest display name ─────────────────────────────────────────────
const chest = findRow(43299);
const chestProps = chest.actor_data.blob.properties;
const nameProp = findProp(chestProps, 'JianZhuDisplayName');
console.log(`[1] chest name: ${JSON.stringify(nameProp.value.displayString)} -> "Claude's Cabinet"`);
nameProp.value.displayString = "Claude's Cabinet";

// ── Edit 2: iron ingot stack count ─────────────────────────────────────────
const inv = findRow(43298);
const baoGuoComp = findProp(inv.actor_data.blob.properties, 'BaoGuoComponent');
const baoGuoList = findProp(baoGuoComp.value.embedded, 'BaoGuoDaoJuList');
const entries = findProp(baoGuoList.value.properties, 'DaoJuEntries');
// Slot 0 is the iron-ingot stack.
const slot0 = entries.value.elements[0];
const daoJu = findProp(slot0.properties, 'DaoJu');
const amount = findProp(daoJu.value.embedded, 'Amount');
console.log(`[2] iron ingot Amount: ${amount.value} -> 99`);
amount.value = 99;

// ── Edit 3: access-log row ─────────────────────────────────────────────────
const log = findProp(chestProps, 'RongQiCunQuRiZhiData');
const logRow0 = log.value.elements[0];
const cnt = findProp(logRow0.properties, 'DaoJuCount');
const op  = findProp(logRow0.properties, 'CaoZuoZheName');
console.log(`[3a] log count: ${cnt.value} -> 99`);
cnt.value = 99;
console.log(`[3b] log operator: ${JSON.stringify(op.value.displayString)} -> "AutoTest"`);
op.value.displayString = "AutoTest";

// ── Write out ───────────────────────────────────────────────────────────────
fs.writeFileSync(outPath, JSON.stringify(j));
console.log(`\nwrote ${outPath}`);
console.log('Next: node --max-old-space-size=4096 scripts/json-to-db.mjs ' + outPath + ' world-test.db');
