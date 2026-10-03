import { owner, body, profilePayload, sameOrigin, badRequest } from "@/lib/api";
import { getStore } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { profile: getStore().getProfile(await owner()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PUT(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  let profile;
  try {
    profile = profilePayload(await body(request));
  } catch {
    return badRequest();
  }
  getStore().saveProfile(await owner(), profile);
  return Response.json({ profile });
}
