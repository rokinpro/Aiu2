import { owner, body, reportPayload, sameOrigin, badRequest } from "@/lib/api";
import { getStore } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { reports: getStore().getReports(await owner()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  let input;
  try {
    input = reportPayload(await body(request));
  } catch {
    return badRequest();
  }
  const id = await owner();
  if (
    getStore()
      .getReports(id)
      .filter((r) => Date.now() - Date.parse(r.reportedAt) < 60000).length >= 10
  )
    return Response.json(
      { error: "Please wait a minute before sending more observations." },
      { status: 429 },
    );
  return Response.json(
    { report: getStore().saveReport(id, input) },
    { status: 201 },
  );
}
