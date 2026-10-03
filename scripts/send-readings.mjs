// Authenticated generated inputs for development; never label these as hardware.
import { randomUUID } from "node:crypto";
const token = process.env.AIU2_INGEST_TOKEN;
const origin = process.env.AIU2_API_URL || "http://127.0.0.1:3003";
const distance = Number(process.argv[2] || 20);
const seconds = Number(process.argv[3] || 15);
if (
  !token ||
  !Number.isFinite(distance) ||
  distance <= 0 ||
  !Number.isFinite(seconds) ||
  seconds <= 0 ||
  seconds > 300
)
  throw new Error(
    "Set AIU2_INGEST_TOKEN and supply distance_cm and duration_seconds (max 300).",
  );
const bridgeSessionId = randomUUID();
for (let sequence = 0; sequence < seconds * 5; sequence++) {
  const response = await fetch(`${origin}/api/sensors/ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deviceId: "beacon-a",
      zoneId: "elevator-a-lobby",
      bridgeSessionId,
      sequence,
      sourceMode: "simulation",
      distanceCm: distance,
      validDistance: true,
    }),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Ingestion returned ${response.status}`);
  await new Promise((resolve) => setTimeout(resolve, 200));
}
console.log(
  "Generated readings accepted. Feed stopped; freshness will expire after five seconds.",
);
