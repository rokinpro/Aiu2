import { authorized, body, sensorPayload, badRequest } from "@/lib/api";
import { getStore } from "@/lib/storage";
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
  const result = getStore().ingest(input);
  return Response.json(result, { status: result.duplicate ? 200 : 201 });
}
