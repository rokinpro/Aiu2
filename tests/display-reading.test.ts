import test from "node:test";
import assert from "node:assert/strict";
import { advanceDisplayReading, EMPTY_DISPLAY_READING } from "../lib/display-reading";
import type { Condition } from "../lib/types";

const start = Date.parse("2026-10-03T18:00:00Z");
function sample(distanceCm: number | null, elapsedMs: number): Condition {
  return {
    zoneId: "elevator-a-lobby",
    activity: "sustained",
    sourceMode: "hardware",
    receivedAt: new Date(start + elapsedMs).toISOString(),
    distanceCm,
  };
}

test("display holds echo jitter but responds to a real distance change", () => {
  let view = advanceDisplayReading(EMPTY_DISPLAY_READING, sample(20.6, 0), start);
  for (const [cm, elapsed] of [[22.8, 1000], [21.9, 2000], [20.9, 3000]] as const)
    view = advanceDisplayReading(view, sample(cm, elapsed), start + elapsed);
  assert.equal(view.distanceCm, 20.6);
  view = advanceDisplayReading(view, sample(23.1, 4000), start + 4000);
  assert.equal(view.distanceCm, 20.6);
  view = advanceDisplayReading(view, sample(24, 5000), start + 5000);
  assert.equal(view.distanceCm, 24);
  view = advanceDisplayReading(view, sample(60, 6000), start + 6000);
  assert.equal(view.distanceCm, 60);
});

test("display does not treat invalid or stale echoes as clear space", () => {
  let view = advanceDisplayReading(EMPTY_DISPLAY_READING, sample(20, 0), start);
  view = advanceDisplayReading(view, sample(null, 1000), start + 1000);
  assert.equal(view.distanceCm, 20);
  view = advanceDisplayReading(view, sample(null, 2000), start + 2000);
  assert.equal(view.distanceCm, null);
  view = advanceDisplayReading(view, sample(60, 3000), start + 3000);
  assert.equal(view.distanceCm, 60);
  assert.equal(advanceDisplayReading(view, sample(60, 3000), start + 9000).distanceCm, null);
});
