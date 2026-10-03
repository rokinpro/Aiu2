import "server-only";
import { createHash } from "node:crypto";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const cached = new Map<string, { until: number; audio: Promise<Buffer> }>();
const CACHE_MS = 60 * 60 * 1000;
const MAX_BYTES = 2_000_000;

export async function routeAudio(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID;
  if (!apiKey || !voiceId || !modelId) throw new Error("Speech is not configured");

  const key = createHash("sha256").update(`${voiceId}\0${modelId}\0${text}`).digest("hex");
  const now = Date.now();
  const hit = cached.get(key);
  if (hit && hit.until > now) return hit.audio;
  cached.delete(key);
  for (const [id, entry] of cached) if (entry.until <= now) cached.delete(id);
  while (cached.size >= 20) cached.delete(cached.keys().next().value!);

  const audio = (async () => {
    const client = new ElevenLabsClient({ apiKey });
    const stream = await client.textToSpeech.convert(voiceId, {
      text, modelId, outputFormat: "mp3_44100_128",
    }, { timeoutInSeconds: 12, maxRetries: 0 });
    const chunks: Buffer[] = [];
    let bytes = 0;
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > MAX_BYTES) throw new Error("Speech response too large");
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    if (!bytes) throw new Error("Empty speech response");
    return Buffer.concat(chunks);
  })();
  cached.set(key, { until: now + CACHE_MS, audio });
  try { return await audio; }
  catch (error) { cached.delete(key); throw error; }
}
