/**
 * Test: adversarial fuzz for peekLooksLikePropertyTag.
 *
 * The peek is the codec's only discriminator between FGuid bytes and a
 * tagged property-stream header in three places (Map<Struct,_> keys,
 * Map<_,Struct> values, Set<Struct> elements). A false positive there
 * causes the codec to misread random FGuid bytes as a property name and
 * walk off into garbage. This test verifies:
 *
 *   1. Random 16-byte (FGuid-shaped) buffers are rejected.
 *   2. Adversarial buffers with the saveNum field forced into the plausible
 *      [2, 64] window are still overwhelmingly rejected (the identifier-
 *      safe + NUL-terminator checks are doing real work).
 *   3. Valid property-name FStrings constructed from the identifier
 *      alphabet are accepted (no false negatives within spec).
 *   4. Boundary conditions: saveNum=1, =2, =64, =65, missing NUL,
 *      non-identifier byte in the body, truncated buffer, UTF-16 (negative
 *      saveNum) all behave as documented.
 *
 * Self-contained — does not need a world.db. Run via `npm test` or
 * directly: `node test/test-peek-fuzz.mjs`.
 */

import { peekLooksLikePropertyTag } from '../src/property-stream.mjs';
import { Cursor } from '../src/io.mjs';

// Deterministic xorshift32 so a failing run can be reproduced from the seed.
class RNG {
  constructor(seed = 0xDEADBEEF) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let s = this.s;
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    this.s = s;
    return s;
  }
  byte() { return this.next() & 0xFF; }
}

// The identifier alphabet the peek accepts: A-Z, a-z, 0-9, _.
const ID_BYTES = (() => {
  const out = [];
  for (let b = 0; b < 256; b++) {
    if (b === 0x5F ||
        (b >= 0x30 && b <= 0x39) ||
        (b >= 0x41 && b <= 0x5A) ||
        (b >= 0x61 && b <= 0x7A)) {
      out.push(b);
    }
  }
  return out;
})();

function makeCursor(bytes) { return new Cursor(bytes); }
function setInt32LE(buf, off, v) { new DataView(buf.buffer).setInt32(off, v, true); }

let fails = 0;
function expect(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); fails++; }
}

// ── 1. Random 16-byte buffers (FGuid-shaped) ───────────────────────────────
{
  const rng = new RNG(0xDEAD0001);
  const N = 1_000_000;
  let positives = 0;
  for (let i = 0; i < N; i++) {
    const buf = new Uint8Array(16);
    for (let j = 0; j < 16; j++) buf[j] = rng.byte();
    if (peekLooksLikePropertyTag(makeCursor(buf))) positives++;
  }
  // Back-of-envelope upper bound: P(len in [2,64]) ≈ 63/2^32 ≈ 1.47e-8.
  // Across 1M draws expected positives ≈ 0.015. Setting threshold to 5
  // gives essentially zero false-failure probability while still catching
  // catastrophic regressions (e.g. someone removes the NUL check).
  console.log(`[random GUIDs]      ${positives}/${N} accepted`);
  expect(positives < 5,
    `random 16-byte buffers: expected < 5 false positives, got ${positives}`);
}

// ── 2. Adversarial: force saveNum into [2, 64], leave body random ──────────
{
  const rng = new RNG(0xDEAD0002);
  const N = 200_000;
  let positives = 0;
  for (let i = 0; i < N; i++) {
    const len = 2 + (rng.next() % 63);   // 2..64
    // Use a buffer wide enough to satisfy the >= 8 and >= 4+len precondition.
    const buf = new Uint8Array(Math.max(16, 4 + len));
    for (let j = 0; j < buf.length; j++) buf[j] = rng.byte();
    setInt32LE(buf, 0, len);
    if (peekLooksLikePropertyTag(makeCursor(buf))) positives++;
  }
  // With saveNum forced valid, acceptance reduces to (1/256) NUL-at-tail
  // × (63/256)^(len-1) identifier-body, averaged over len in [2,64].
  // For len=2 alone: 1/256 × 63/256 ≈ 9.6e-4. Average across len bands
  // skews very small because the (63/256)^k factor collapses for longer
  // strings. 200k draws → expected positives < ~50; use 200 as a generous
  // threshold that still flags a ≥4x regression.
  console.log(`[forced saveNum]    ${positives}/${N} accepted`);
  expect(positives < 200,
    `forced-saveNum + random body: expected < 200 accepts, got ${positives}`);
}

// ── 3. Positive: valid identifier-FString bodies should ALWAYS be accepted ──
{
  const rng = new RNG(0xDEAD0003);
  const N = 10_000;
  for (let i = 0; i < N; i++) {
    const len = 2 + (rng.next() % 63);   // 2..64 incl. NUL
    const buf = new Uint8Array(Math.max(8, 4 + len));
    setInt32LE(buf, 0, len);
    for (let j = 0; j < len - 1; j++) {
      buf[4 + j] = ID_BYTES[rng.next() % ID_BYTES.length];
    }
    buf[4 + len - 1] = 0;
    expect(peekLooksLikePropertyTag(makeCursor(buf)),
      `valid id-FString len=${len} (seed iteration ${i}) was rejected`);
  }
  console.log(`[valid id-FString]  ${N}/${N} accepted (no false negatives)`);
}

// ── 4. Boundary / edge cases ───────────────────────────────────────────────
{
  // 4a. saveNum=1 (1 byte = just the NUL terminator, empty content): REJECT.
  //     Empty property names don't occur in Soulmask saves.
  {
    const buf = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(!peekLooksLikePropertyTag(makeCursor(buf)),
      'saveNum=1 (empty name) should be rejected');
  }

  // 4b. saveNum=2 minimum accepted length: ACCEPT.
  {
    const buf = new Uint8Array(8);
    setInt32LE(buf, 0, 2);
    buf[4] = 0x41;  // 'A'
    buf[5] = 0x00;
    expect(peekLooksLikePropertyTag(makeCursor(buf)),
      'saveNum=2 with valid body should be accepted');
  }

  // 4c. saveNum=64 maximum accepted length: ACCEPT.
  {
    const buf = new Uint8Array(4 + 64);
    setInt32LE(buf, 0, 64);
    for (let i = 0; i < 63; i++) buf[4 + i] = 0x41;  // 'A' * 63
    buf[4 + 63] = 0;
    expect(peekLooksLikePropertyTag(makeCursor(buf)),
      'saveNum=64 (max allowed) should be accepted');
  }

  // 4d. saveNum=65 just over max: REJECT.
  {
    const buf = new Uint8Array(4 + 65);
    setInt32LE(buf, 0, 65);
    for (let i = 0; i < 64; i++) buf[4 + i] = 0x41;
    buf[4 + 64] = 0;
    expect(!peekLooksLikePropertyTag(makeCursor(buf)),
      'saveNum=65 (just over max) should be rejected');
  }

  // 4e. Missing NUL terminator: REJECT.
  {
    const buf = new Uint8Array(4 + 5);
    setInt32LE(buf, 0, 5);
    for (let i = 0; i < 5; i++) buf[4 + i] = 0x41;  // 'AAAAA', no NUL at end
    expect(!peekLooksLikePropertyTag(makeCursor(buf)),
      'missing NUL terminator should be rejected');
  }

  // 4f. Non-identifier byte (space) in body: REJECT.
  {
    const buf = new Uint8Array(4 + 4);
    setInt32LE(buf, 0, 4);
    buf[4] = 0x41;  // 'A'
    buf[5] = 0x20;  // ' ' (space, not in ID alphabet)
    buf[6] = 0x41;  // 'A'
    buf[7] = 0x00;
    expect(!peekLooksLikePropertyTag(makeCursor(buf)),
      'space in body should be rejected');
  }

  // 4g. Hyphen, period, slash — common in paths but not in property names: REJECT.
  for (const badByte of [0x2D, 0x2E, 0x2F]) {  // - . /
    const buf = new Uint8Array(8);
    setInt32LE(buf, 0, 3);
    buf[4] = 0x41;
    buf[5] = badByte;
    buf[6] = 0x00;
    expect(!peekLooksLikePropertyTag(makeCursor(buf)),
      `byte 0x${badByte.toString(16)} in body should be rejected`);
  }

  // 4h. Truncated buffer (saveNum says 8 but only 4 body bytes follow): REJECT.
  {
    const buf = new Uint8Array(8);
    setInt32LE(buf, 0, 8);
    expect(!peekLooksLikePropertyTag(makeCursor(buf)),
      'buffer too small for declared length should be rejected');
  }

  // 4i. UTF-16 (negative saveNum): REJECT per current design.
  //     The peek's documented limitation — would need a separate branch
  //     to support. Soulmask property names are observed-ANSI-only.
  {
    const buf = new Uint8Array(20);
    setInt32LE(buf, 0, -4);
    expect(!peekLooksLikePropertyTag(makeCursor(buf)),
      'UTF-16 (negative saveNum) should be rejected (documented limitation)');
  }

  // 4j. Buffer shorter than 8 bytes: REJECT (precondition check).
  {
    for (const n of [0, 1, 4, 7]) {
      const buf = new Uint8Array(n);
      expect(!peekLooksLikePropertyTag(makeCursor(buf)),
        `buffer of length ${n} (< 8) should be rejected without throwing`);
    }
  }

  // 4k. saveNum=0 (FString null form): REJECT.
  {
    const buf = new Uint8Array(8);  // all zero
    expect(!peekLooksLikePropertyTag(makeCursor(buf)),
      'saveNum=0 (FString null form) should be rejected');
  }

  // 4l. Realistic property names from Soulmask: ACCEPT.
  //     Pad the buffer to >= 8 bytes (peek's defensive precondition) so
  //     short names like 'a'/'A1' aren't rejected by the buffer-size
  //     check before content is examined. In real callers the cursor's
  //     remaining bytes are always well over 8.
  for (const name of ['Owner', 'JianZhuDisplayName', 'XinQingTagLog',
                      'A1', '_underscore', 'CamelCaseName',
                      'WithDigits42', 'a', 'PlayerGongHuiMap']) {
    if (name.length < 1) continue;
    const len = name.length + 1;       // include NUL
    if (len > 64) continue;            // out of peek's accepted range
    const buf = new Uint8Array(Math.max(8, 4 + len));
    setInt32LE(buf, 0, len);
    for (let i = 0; i < name.length; i++) buf[4 + i] = name.charCodeAt(i);
    buf[4 + name.length] = 0;
    expect(peekLooksLikePropertyTag(makeCursor(buf)),
      `realistic Soulmask name '${name}' should be accepted`);
  }
}

if (fails > 0) {
  console.error(`\n❌ ${fails} assertion(s) failed`);
  process.exit(1);
}
console.log('\n✅ peek-fuzz: all assertions passed');
