import { body, owner, profilePayload, sameOrigin } from "@/lib/api";
import { nodes } from "@/lib/demo";
import { guidanceFor } from "@/lib/node-guidance";
import { getStore } from "@/lib/storage";
import type { PairedSession } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  const ownerId = await owner();
  const session = store.getPairing(ownerId);
  const conditions = store.conditions().zones.flatMap((zone) => zone.condition ? [zone.condition] : []);
  return Response.json({
    session,
    command: session ? store.latestCommand(ownerId) : null,
    guidance: session ? guidanceFor(session, conditions).phone : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  let input: Pick<PairedSession, "profileSlot" | "profile" | "destination" | "outputChoice">;
  try {
    const data = await body(request);
    if (data.nodeCode !== "A1" || !["A", "B"].includes(String(data.profileSlot)) ||
        !["text", "speech"].includes(String(data.outputChoice)) ||
        !nodes.some((node) => node.id === data.destination)) throw new Error("Invalid pairing");
    input = {
      profileSlot: data.profileSlot as PairedSession["profileSlot"],
      profile: profilePayload(data.profile as Record<string, unknown>),
      destination: data.destination as string,
      outputChoice: data.outputChoice as PairedSession["outputChoice"],
    };
  } catch {
    return Response.json({ error: "Check the beacon and profile choices." }, { status: 400 });
  }
  const session = getStore().pairNode(await owner(), input);
  if (!session) return Response.json({ error: "This node is paired with another traveler. Try again shortly." }, { status: 409 });
  return Response.json({ session }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  getStore().unpairNode(await owner());
  return Response.json({ session: null });
}
