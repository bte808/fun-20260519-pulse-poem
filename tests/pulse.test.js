import assert from "node:assert/strict";
import {
  createPulsePattern,
  decodeShareState,
  encodeShareState,
  estimateSyllables,
  patternToShareText,
  patternToTapScore,
  tokenize
} from "../src/pulse.js";

const pattern = createPulsePattern("storm glass, tiny robot!", "bright");

assert.equal(pattern.mode, "bright");
assert.ok(pattern.pulses.length >= 4, "expected a pulse for each word");
assert.ok(pattern.totalDuration > 400, "expected playable duration");
assert.ok(pattern.signature.includes(" "), "expected readable rhythm signature");

for (let index = 1; index < pattern.pulses.length; index += 1) {
  assert.ok(
    pattern.pulses[index].start > pattern.pulses[index - 1].start,
    "pulse starts should move forward"
  );
}

const calm = createPulsePattern("storm glass, tiny robot!", "calm");
const drumline = createPulsePattern("storm glass, tiny robot!", "drumline");
assert.notEqual(calm.signature, drumline.signature, "modes should change the rhythm shape");

const withComma = createPulsePattern("tap, tap", "bright");
const withoutComma = createPulsePattern("tap tap", "bright");
assert.ok(withComma.totalDuration > withoutComma.totalDuration, "punctuation should add a rest");

assert.equal(estimateSyllables("robot"), 2);
assert.deepEqual(tokenize("a -- b").slice(0, 3), ["a", "--", "b"]);

const score = patternToTapScore(pattern);
assert.match(score, /storm/);
assert.match(score, /ms/);

const shareText = patternToShareText(pattern);
assert.match(shareText, /^storm glass, tiny robot!/);
assert.match(shareText, /Bright:/);
assert.match(shareText, /THUMP|tap|tick/);

const decoded = decodeShareState(encodeShareState("hello pulse", "calm"));
assert.equal(decoded.text, "hello pulse");
assert.equal(decoded.mode, "calm");

console.log("pulse tests passed");
