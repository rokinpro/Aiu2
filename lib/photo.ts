import type { PhotoCandidate, PhotoDraft } from "./types";

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const kinds = new Set<PhotoCandidate["kind"]>([
  "stairs", "ramp", "signage", "entrance", "elevator", "bench",
]);
const aliases: Record<string, PhotoCandidate["kind"]> = {
  stairs: "stairs", steps: "stairs", ramp: "ramp", signage: "signage", sign: "signage",
  entrance: "entrance", elevator: "elevator", lift: "elevator", bench: "bench",
};

export function detectPhotoType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
      Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP") return "image/webp";
  if (Buffer.from(bytes.subarray(4, 8)).toString() === "ftyp") {
    const brand = Buffer.from(bytes.subarray(8, 12)).toString();
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heim", "heis"].includes(brand)) return "image/heif";
  }
  return null;
}

export function photoDraftFromModel(raw: unknown, model: string): PhotoDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid photo response");
  const input = raw as Record<string, unknown>;
  if (!Array.isArray(input.features) || input.features.length > 5) throw new Error("Invalid photo features");
  const candidates: PhotoCandidate[] = [];
  for (const item of input.features) {
    if (typeof item !== "string" || item.length > 30) throw new Error("Invalid photo feature");
    const kind = aliases[item.trim().toLowerCase()];
    if (!kind || !kinds.has(kind) || candidates.some((candidate) => candidate.kind === kind)) continue;
    candidates.push({ kind, confidence: "possible" });
  }
  const parts = candidates.map((candidate) => candidate.kind);
  const draft = parts.length
    ? `Photo may show ${parts.join(" and ")}. Please confirm these details at the selected location.`
    : "No supported access features are clear in this photo. Please describe what you observed at the selected location.";
  return {
    candidates, draft,
    missingDetails: ["Confirm the exact location", "Confirm current access conditions", "Add measurements only if checked directly"],
    uncertainty: "A photo cannot establish clear width, slope, legal compliance, Braille accuracy, a continuous accessible route or current passability.",
    source: "Gemini", model,
  };
}
