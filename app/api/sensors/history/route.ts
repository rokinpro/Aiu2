import { sensorArchiveSummary } from "@/lib/tiger-sensors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const devices = await sensorArchiveSummary();
    return Response.json({ status: devices ? "connected" : "not_configured", devices: devices ?? [] },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", devices: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
