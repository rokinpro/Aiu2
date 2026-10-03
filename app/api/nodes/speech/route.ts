import { body, owner, sameOrigin } from "@/lib/api";
import { guidanceFor } from "@/lib/node-guidance";
import { routeAudio } from "@/lib/speech";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  let routeId: string;
  try {
    const data = await body(request);
    if (typeof data.routeId !== "string" || data.routeId.length > 150) throw new Error();
    routeId = data.routeId;
  } catch {
    return Response.json({ error: "Select current directions before playing speech." }, { status: 400 });
  }
  const store = getStore();
  const session = store.getPairing(await owner());
  if (!session || session.outputChoice !== "speech")
    return Response.json({ error: "Connect a profile with speech selected first." }, { status: 403 });
  const conditions = store.conditions().zones.flatMap((zone) => zone.condition ? [zone.condition] : []);
  const guidance = guidanceFor(session, conditions).phone;
  if (!guidance.routeId || guidance.routeId !== routeId)
    return Response.json({ error: "Directions changed. Review the current text and play again." }, { status: 409 });

  // All spoken content comes from the server's deterministic route guidance.
  const text = [guidance.headline, guidance.detail, ...guidance.textDirections].join(" ");
  try {
    const audio = await routeAudio(text);
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store",
        "X-Aiu2-Audio-Source": "ElevenLabs" },
    });
  } catch (error) {
    const providerError = error as { name?: string; statusCode?: number; cause?: { cause?: { code?: string } } };
    console.warn("ElevenLabs speech request failed", {
      name: providerError?.name, statusCode: providerError?.statusCode,
      causeCode: providerError?.cause?.cause?.code,
    });
    return Response.json({ error: "ElevenLabs speech is unavailable. Browser speech can read the text directions." }, { status: 503 });
  }
}
