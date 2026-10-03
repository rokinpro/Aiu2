import type { Condition } from "./types";
export const FRESHNESS_MS = 5000;
export const STABLE_SAMPLES = 3;
export function currentActivity(
  condition: Condition | undefined,
  now: number,
): Condition["activity"] {
  const received = Date.parse(condition?.receivedAt ?? "");
  return condition &&
    Number.isFinite(received) &&
    now >= received &&
    now - received <= FRESHNESS_MS
    ? condition.activity
    : "unknown";
}
export type Stability = {
  candidate: Condition["activity"];
  count: number;
  activity: Condition["activity"];
};
export function advanceActivity(
  previous: Stability,
  candidate: Condition["activity"],
): Stability {
  const count = previous.candidate === candidate ? previous.count + 1 : 1;
  return {
    candidate,
    count,
    activity: count >= STABLE_SAMPLES ? candidate : previous.activity,
  };
}
