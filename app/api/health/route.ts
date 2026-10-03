import { getStore } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    getStore();
    return Response.json({
      status: "ok",
      storage: "sqlite",
      ingestionConfigured: (process.env.AIU2_INGEST_TOKEN?.length ?? 0) >= 24,
    });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
