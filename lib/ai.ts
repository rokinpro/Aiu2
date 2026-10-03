import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { IamAuthenticator } from "ibm-cloud-sdk-core";
import type { PreferenceSuggestion } from "./types";

const keys = ["noStairs", "lessWalking", "quieter", "resting", "avoidDim", "smoother"] as const;
export const WATSONX_MODEL = "ibm/granite-4-h-small";

const fallbackPatterns: Array<[PreferenceSuggestion["key"], RegExp]> = [
  ["noStairs", /avoid stairs|no stairs|can't use stairs|cannot use stairs/i],
  ["lessWalking", /less walking|shorter walk|walk less/i],
  ["quieter", /quieter|quiet route|less crowded|avoid crowds|avoid noise/i],
  ["resting", /resting point|stop at a bench|need a bench|take a break|rest stop/i],
  ["avoidDim", /avoid dim|well lit|bright route/i],
  ["smoother", /smooth path|smoother path|avoid gravel|avoid rough/i],
];
export function localSuggestions(source: string): PreferenceSuggestion[] {
  return fallbackPatterns.flatMap(([key, pattern]) => {
    const evidence = source.match(pattern)?.[0];
    return evidence ? [{ key, evidence }] : [];
  });
}

export function validateSuggestions(value: unknown, source: string): PreferenceSuggestion[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid AI response");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => key !== "choices") || !Array.isArray(object.choices) || object.choices.length > keys.length)
    throw new Error("Invalid AI response");
  const seen = new Set<string>();
  return object.choices.map((choice: unknown) => {
    if (!choice || typeof choice !== "object" || Array.isArray(choice)) throw new Error("Invalid AI response");
    const item = choice as Record<string, unknown>;
    if (Object.keys(item).sort().join(",") !== "evidence,key" ||
      !keys.includes(item.key as typeof keys[number]) ||
      typeof item.evidence !== "string" ||
      item.evidence.length < 2 || item.evidence.length > 100 ||
      !source.toLocaleLowerCase().includes(item.evidence.toLocaleLowerCase()) ||
      seen.has(item.key as string)) throw new Error("Invalid AI response");
    seen.add(item.key as string);
    return { key: item.key as PreferenceSuggestion["key"], evidence: item.evidence as string };
  });
}

export async function interpretPreferences(source: string): Promise<PreferenceSuggestion[]> {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const serviceUrl = process.env.WATSONX_URL;
  if (!apiKey || !projectId || !serviceUrl) throw new Error("Watsonx is not configured");
  const service = new WatsonXAI({
    version: "2024-05-31",
    serviceUrl,
    authenticator: new IamAuthenticator({ apikey: apiKey }),
  });
  const response = await service.textChat({
    modelId: process.env.WATSONX_MODEL_ID || WATSONX_MODEL,
    projectId,
    maxTokens: 220,
    temperature: 0,
    timeLimit: 7000,
    signal: AbortSignal.timeout(9000),
    messages: [
      { role: "system", content: `Interpret the traveler's words only as preferences. Return only JSON of the form {"choices":[{"key":"noStairs","evidence":"exact words copied from input"}]}. Allowed keys: noStairs (explicitly avoid stairs), lessWalking (shorter walking), quieter (less crowd/noise), resting (rest stop/bench), avoidDim (avoid dim spaces), smoother (smooth surface). Include only explicit requests. Evidence must be an exact substring of the input. Never infer a disability or diagnosis. Never provide routes, dimensions, availability, contacts, or medical advice. Unknown or unstated fields are omitted.`, },
      { role: "user", content: source },
    ],
  });
  const content = response.result.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Invalid AI response");
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid AI response");
  return validateSuggestions(JSON.parse(match[0]), source);
}
