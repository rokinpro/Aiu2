import { getStore } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(getStore().conditions(), {
    headers: { "Cache-Control": "no-store" },
  });
}
