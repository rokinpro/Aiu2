import type { Condition } from "./types";

export type DisplayReading = {
  distanceCm: number | null;
  sourceMode: Condition["sourceMode"] | null;
  receivedAt: string | null;
  direction: -1 | 0 | 1;
  pendingCount: number;
  invalidCount: number;
};

export const EMPTY_DISPLAY_READING: DisplayReading = {
  distanceCm: null,
  sourceMode: null,
  receivedAt: null,
  direction: 0,
  pendingCount: 0,
  invalidCount: 0,
};

// Hold isolated small changes for the screen only. Routing and freshness still use
// every accepted reading and the server's confirmed activity state.
export function advanceDisplayReading(
  previous: DisplayReading,
  condition: Condition | null,
  now: number,
): DisplayReading {
  const received = Date.parse(condition?.receivedAt ?? "");
  if (!condition || !Number.isFinite(received) || now - received > 5000 || received > now)
    return EMPTY_DISPLAY_READING;
  if (condition.receivedAt === previous.receivedAt && condition.sourceMode === previous.sourceMode)
    return previous;

  const next = {
    ...EMPTY_DISPLAY_READING,
    sourceMode: condition.sourceMode,
    receivedAt: condition.receivedAt,
  };
  const raw = condition.distanceCm;
  if (condition.sourceMode !== previous.sourceMode)
    return { ...next, distanceCm: raw };
  if (raw === null) {
    const invalidCount = previous.invalidCount + 1;
    return { ...next, distanceCm: invalidCount >= 2 ? null : previous.distanceCm, invalidCount };
  }
  if (previous.distanceCm === null || Math.abs(raw - previous.distanceCm) >= 8)
    return { ...next, distanceCm: raw };

  const difference = raw - previous.distanceCm;
  if (Math.abs(difference) < 2)
    return { ...next, distanceCm: previous.distanceCm };
  const direction = Math.sign(difference) as -1 | 1;
  const pendingCount = previous.direction === direction ? previous.pendingCount + 1 : 1;
  return pendingCount >= 2
    ? { ...next, distanceCm: raw }
    : { ...next, distanceCm: previous.distanceCm, direction, pendingCount };
}
