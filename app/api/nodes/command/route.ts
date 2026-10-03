import { authorized, body } from "@/lib/api";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function auth(request: Request) {
  if (!process.env.AIU2_INGEST_TOKEN || process.env.AIU2_INGEST_TOKEN.length < 24)
    return Response.json({ error: "Node bridge is not configured" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
export async function GET(request: Request) {
  const denied = auth(request);
  if (denied) return denied;
  const deviceId = new URL(request.url).searchParams.get("deviceId");
  if (deviceId !== "beacon-a") return Response.json({ error: "Unknown node" }, { status: 400 });
  return Response.json({ command: getStore().pendingCommand(deviceId) },
    { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const denied = auth(request);
  if (denied) return denied;
  let deviceId: string, commandId: string, status: "received" | "rejected";
  try {
    const data = await body(request);
    if (data.deviceId !== "beacon-a" || typeof data.commandId !== "string" ||
        !/^[0-9a-f-]{36}$/.test(data.commandId) || !["received", "rejected"].includes(String(data.status)))
      throw new Error("Invalid acknowledgement");
    deviceId = data.deviceId;
    commandId = data.commandId;
    status = data.status as "received" | "rejected";
  } catch {
    return Response.json({ error: "Invalid acknowledgement" }, { status: 400 });
  }
  const result = getStore().acknowledgeCommand(deviceId, commandId, status);
  if (!result) return Response.json({ error: "Command expired or unavailable" }, { status: 410 });
  return Response.json(result);
}
