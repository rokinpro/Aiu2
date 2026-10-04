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
  const pending = getStore().pendingCommand(deviceId);
  // The bridge needs only an opaque command ID, a short code and a relative TTL.
  // Keep the paired profile, destination and route ID on the server/phone.
  const command = pending ? {
    id: pending.id, nodeId: pending.nodeId, code: pending.code,
    // The controller clock may be unset; give the bridge a relative lifetime.
    ttlMs: Math.max(0, new Date(pending.expiresAt).getTime() - Date.now()),
  } : null;
  return Response.json({ command },
    { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const denied = auth(request);
  if (denied) return denied;
  let deviceId: string, commandId: string, status: "received" | "rejected", actuatorExecuted: boolean;
  try {
    const data = await body(request);
    if (data.deviceId !== "beacon-a" || typeof data.commandId !== "string" ||
        !/^[0-9a-f-]{36}$/.test(data.commandId) || !["received", "rejected"].includes(String(data.status)) ||
        typeof data.actuatorExecuted !== "boolean" ||
        (data.status === "rejected" && data.actuatorExecuted))
      throw new Error("Invalid acknowledgement");
    deviceId = data.deviceId;
    commandId = data.commandId;
    status = data.status as "received" | "rejected";
    actuatorExecuted = data.actuatorExecuted as boolean;
  } catch {
    return Response.json({ error: "Invalid acknowledgement" }, { status: 400 });
  }
  const result = getStore().acknowledgeCommand(deviceId, commandId, status, Date.now(), actuatorExecuted);
  if (!result) return Response.json({ error: "Command expired or unavailable" }, { status: 410 });
  return Response.json(result);
}
