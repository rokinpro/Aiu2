import { body, sameOrigin } from "@/lib/api";
import { interpretPreferences, localSuggestions } from "@/lib/ai";

export const runtime = "nodejs";
const requests = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  let source: string;
  try {
    const payload = await body(request);
    if (typeof payload.text !== "string" || payload.text.trim().length < 4 || payload.text.length > 500)
      throw new Error("Invalid input");
    source = payload.text.trim();
  } catch {
    return Response.json({ error: "Write a short description of what helps you travel." }, { status: 400 });
  }
  const session = request.headers.get("cookie")?.match(/aiu2-session=([^;]+)/)?.[1] ?? request.headers.get("x-forwarded-for") ?? "visitor";
  const now = Date.now();
  const recent = (requests.get(session) ?? []).filter((time) => now - time < 60000);
  if (recent.length >= 5) return Response.json({ error: "Please wait a moment before trying again." }, { status: 429 });
  requests.set(session, [...recent, now]);
  try {
    return Response.json({ suggestions: await interpretPreferences(source), source: "IBM Granite" });
  } catch {
    return Response.json({
      suggestions: localSuggestions(source),
      source: "Local fallback · IBM unavailable",
    });
  }
}
