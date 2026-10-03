import test from "node:test";
import assert from "node:assert/strict";
import { localSuggestions, validateSuggestions } from "../lib/ai";

test("preference suggestions require exact evidence and allowed unique keys", () => {
  const source = "I want to avoid stairs and stop at a bench.";
  assert.deepEqual(localSuggestions(source).map((item) => item.key), ["noStairs", "resting"]);
  assert.deepEqual(validateSuggestions({ choices: [{ key: "noStairs", evidence: "avoid stairs" }] }, source), [{ key: "noStairs", evidence: "avoid stairs" }]);
  assert.throws(() => validateSuggestions({ choices: [{ key: "minWidthCm", evidence: "avoid stairs" }] }, source));
  assert.throws(() => validateSuggestions({ choices: [{ key: "noStairs", evidence: "I use a wheelchair" }] }, source));
  assert.throws(() => validateSuggestions({ choices: [{ key: "noStairs", evidence: "avoid stairs", value: false }] }, source));
});
