import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { owner, sameOrigin } from "@/lib/api";
import { detectPhotoType, MAX_PHOTO_BYTES, photoDraftFromModel } from "@/lib/photo";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + 32 * 1024;
const requests = new Map<string, number[]>();

async function limitedForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) throw new Error("Use a photo upload");
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) throw new Error("Photo is too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing photo");
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error("Photo is too large");
      }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  const bounded = new Request(request.url, {
    method: "POST", headers: { "content-type": contentType }, body: Buffer.concat(chunks),
  });
  return bounded.formData();
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL_ID;
  if (!apiKey || !model)
    return Response.json({ error: "Photo assistance is not configured. You can still write a report." }, { status: 503 });
  let bytes: Buffer, mimeType: string;
  try {
    const form = await limitedForm(request);
    const photo = form.get("photo");
    if (!(photo instanceof File) || !photo.size || photo.size > MAX_PHOTO_BYTES) throw new Error("Choose a photo up to 4 MB");
    bytes = Buffer.from(await photo.arrayBuffer());
    const detected = detectPhotoType(bytes);
    if (!detected) throw new Error("Use a JPEG, PNG, WebP, HEIC or HEIF photo");
    mimeType = detected;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the photo";
    return Response.json({ error: message }, { status: message.toLowerCase().includes("too large") || message.includes("4 MB") ? 413 : 400 });
  }
  const session = await owner();
  const now = Date.now();
  const recent = (requests.get(session) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 3)
    return Response.json({ error: "Please wait a minute before analyzing another photo." }, { status: 429 });
  requests.set(session, [...recent, now]);

  try {
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateContent({
      model,
      contents: [
        { text: "List only visible candidate features in this photo. Use these exact words: stairs, ramp, signage, entrance, elevator, bench. Return an empty list if none are visible. Do not infer measurements, compliance, route access or current hazards." },
        { inlineData: { mimeType, data: bytes.toString("base64") } },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            features: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["features"],
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        maxOutputTokens: 300,
        abortSignal: AbortSignal.timeout(20_000),
      },
    });
    const draft = photoDraftFromModel(JSON.parse(result.text ?? ""), model);
    return Response.json({ draft }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const providerError = error as { name?: string; status?: number };
    console.warn("Gemini photo draft unavailable", { name: providerError?.name, status: providerError?.status });
    return Response.json({ error: "Photo assistance is unavailable. You can still write your observation." }, { status: 503 });
  }
}
