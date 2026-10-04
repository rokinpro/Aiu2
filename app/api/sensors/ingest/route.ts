import { authorized, body, sensorPayload, badRequest } from "@/lib/api";
import { getStore } from "@/lib/storage";
import { archiveSensorReading } from "@/lib/tiger-sensors";
import { after } from "next/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (
    !process.env.AIU2_INGEST_TOKEN ||
    process.env.AIU2_INGEST_TOKEN.length < 24
  )
    return Response.json(
      { error: "Ingestion is not configured" },
      { status: 503 },
    );
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  let input;
  try {
    input = sensorPayload(await body(request));
  } catch {
    return badRequest();
  }
  const store = getStore();
  const result = store.ingest(input);
  if (!result.duplicate && input.deviceId === "beacon-a" && input.sourceMode === "hardware")
    store.queueOnApproach();
  if (!result.duplicate && process.env.DATABASE_URL)
    after(() => archiveSensorReading(result.reading));
  return Response.json(result, { status: result.duplicate ? 200 : 201 });
}
