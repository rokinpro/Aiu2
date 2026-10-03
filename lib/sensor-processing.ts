import type { Condition, SensorPayload } from "./types";
export type Reading = SensorPayload & { receivedAt: string };
export type SensorState = {
  candidate: Condition["activity"];
  streak: number;
  activity: Condition["activity"];
  lastSummaryMs: number;
  lastReceiptMs: number;
};
export type SensorSummary = {
  activity: Condition["activity"];
  medianCm: number | null;
  occupiedFraction: number | null;
  quality: number;
  validSamples: number;
  totalSamples: number;
};
export const INITIAL_STATE: SensorState = {
  candidate: "unknown",
  streak: 0,
  activity: "unknown",
  lastSummaryMs: 0,
  lastReceiptMs: 0,
};
export function summarize(
  readings: Reading[],
  now: number,
  thresholdCm = 30,
): SensorSummary {
  const window = readings.filter(
    (r) =>
      now - Date.parse(r.receivedAt) < 10000 && Date.parse(r.receivedAt) <= now,
  );
  const valid = window.filter(
    (r) => r.validDistance && r.distanceCm !== null && r.distanceCm > 0,
  );
  const quality = window.length ? valid.length / window.length : 0;
  const sorted = valid
    .slice(-5)
    .map((r) => r.distanceCm!)
    .sort((a, b) => a - b);
  const medianCm = sorted.length
    ? (sorted[Math.floor((sorted.length - 1) / 2)] +
        sorted[Math.floor(sorted.length / 2)]) /
      2
    : null;
  // A sliding median suppresses isolated echoes before the occupied-fraction calculation.
  const filtered = valid.map((_, i) => {
    const values = valid
      .slice(Math.max(0, i - 2), i + 1)
      .map((r) => r.distanceCm!)
      .sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
  const occupiedFraction = valid.length
    ? filtered.filter((cm) => cm <= thresholdCm).length / valid.length
    : null;
  const latest = window.at(-1);
  const stale = !latest || now - Date.parse(latest.receivedAt) > 5000;
  const lastValid = valid.at(-1);
  const insufficient =
    valid.length < 3 ||
    quality < 0.6 ||
    !lastValid ||
    now - Date.parse(lastValid.receivedAt) > 5000;
  const activity: Condition["activity"] =
    stale || insufficient
      ? "unknown"
      : occupiedFraction! < 0.2
        ? "clear"
        : occupiedFraction! <= 0.6
          ? "some"
          : "sustained";
  return {
    activity,
    medianCm,
    occupiedFraction,
    quality,
    validSamples: valid.length,
    totalSamples: window.length,
  };
}
export function advanceSummary(
  previous: SensorState,
  summary: SensorSummary,
  now: number,
): SensorState {
  const base = now - previous.lastReceiptMs > 5000 ? INITIAL_STATE : previous;
  // Insufficient data becomes unknown immediately; never preserve a favorable clear assertion.
  if (summary.activity === "unknown")
    return {
      ...base,
      candidate: "unknown",
      streak: 0,
      activity: "unknown",
      lastReceiptMs: now,
    };
  if (now - base.lastSummaryMs < 1000) return { ...base, lastReceiptMs: now };
  const streak = base.candidate === summary.activity ? base.streak + 1 : 1;
  return {
    candidate: summary.activity,
    streak,
    activity: streak >= 3 ? summary.activity : base.activity,
    lastSummaryMs: now,
    lastReceiptMs: now,
  };
}
