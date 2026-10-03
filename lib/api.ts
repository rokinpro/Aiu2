import { cookies } from "next/headers";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { nodes } from "./demo";
import type { Profile, SensorPayload } from "./types";
export async function owner() {
  const jar = await cookies();
  let id = jar.get("aiu2-session")?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = randomUUID();
    jar.set("aiu2-session", id, {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.AIU2_SECURE_COOKIES === "true",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return id;
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 8192) throw new Error("Request too large");
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Expected object");
  return data;
}
export function sameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    // Next may normalize request.url to localhost; compare the actual HTTP authority.
    return (
      ["http:", "https:"].includes(origin.protocol) &&
      origin.host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}
export function authorized(request: Request) {
  const token = process.env.AIU2_INGEST_TOKEN;
  const supplied = request.headers.get("authorization") ?? "";
  if (!token || token.length < 24) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function profilePayload(data: Record<string, unknown>): Profile {
  const keys = [
    "noStairs",
    "lessWalking",
    "quieter",
    "resting",
    "avoidDim",
    "smoother",
  ] as const;
  for (const k of keys)
    if (typeof data[k] !== "boolean") throw new Error("Invalid preference");
  if (
    data.minWidthCm !== null &&
    (typeof data.minWidthCm !== "number" ||
      !Number.isFinite(data.minWidthCm) ||
      data.minWidthCm <= 0 ||
      data.minWidthCm > 500)
  )
    throw new Error("Invalid width");
  return Object.fromEntries([
    ...keys.map((k) => [k, data[k]]),
    ["minWidthCm", data.minWidthCm],
  ]) as Profile;
}
export function sensorPayload(data: Record<string, unknown>): SensorPayload {
  const devices: Record<string, string> = {
    "beacon-a": "elevator-a-lobby",
    "beacon-b": "elevator-b-lobby",
  };
  if (
    typeof data.deviceId !== "string" ||
    devices[data.deviceId] !== data.zoneId ||
    typeof data.bridgeSessionId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(data.bridgeSessionId) ||
    !Number.isSafeInteger(data.sequence) ||
    (data.sequence as number) < 0 ||
    !["hardware", "simulation", "replay"].includes(String(data.sourceMode)) ||
    typeof data.validDistance !== "boolean"
  )
    throw new Error("Invalid sensor payload");
  const cm = data.distanceCm;
  if (
    cm !== null &&
    (typeof cm !== "number" || !Number.isFinite(cm) || cm <= 0 || cm > 1000)
  )
    throw new Error("Invalid distance");
  if (data.validDistance && cm === null)
    throw new Error("Valid reading requires distance");
  return {
    deviceId: data.deviceId,
    zoneId: data.zoneId as string,
    bridgeSessionId: data.bridgeSessionId,
    sequence: data.sequence as number,
    sourceMode: data.sourceMode as SensorPayload["sourceMode"],
    validDistance: data.validDistance,
    distanceCm: cm as number | null,
    receivedAt: null,
  };
}
export function reportPayload(data: Record<string, unknown>) {
  if (
    !nodes.some((n) => n.id === data.placeId) ||
    !["obstruction", "entrance", "elevator", "other"].includes(
      String(data.category),
    ) ||
    typeof data.details !== "string" ||
    !data.details.trim() ||
    data.details.length > 1000 ||
    typeof data.contributor !== "string" ||
    data.contributor.length > 80
  )
    throw new Error("Invalid report");
  return {
    placeId: String(data.placeId),
    category: data.category as
      "obstruction" | "entrance" | "elevator" | "other",
    details: data.details.trim(),
    contributor: data.contributor.trim() || "Anonymous contributor",
  };
}
export function badRequest() {
  return Response.json(
    { error: "Invalid request. Check the fields and try again." },
    { status: 400 },
  );
}
