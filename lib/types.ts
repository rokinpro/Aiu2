export type Place = {
  id: string;
  name: string;
  floor: 1 | 2;
  kind:
    | "entrance"
    | "junction"
    | "elevator"
    | "stairs"
    | "bench"
    | "classroom"
    | "restroom";
  x: number;
  y: number;
  notes: string;
  verification: "demo" | "verified";
  observedAt: string | null;
};
export type Edge = {
  id: string;
  from: string;
  to: string;
  lengthM: number;
  seconds: number;
  stairs: boolean;
  widthCm: number | null;
  slopePercent: number | null;
  surface: string | null;
  lighting: "bright" | "dim" | null;
  closed: boolean;
  zoneId: string | null;
  verification: "demo" | "verified";
};
export type Graph = { nodes: Place[]; edges: Edge[] };
export type Profile = {
  noStairs: boolean;
  lessWalking: boolean;
  quieter: boolean;
  resting: boolean;
  avoidDim: boolean;
  smoother: boolean;
  minWidthCm: number | null;
};
export type SensorPayload = {
  deviceId: string;
  zoneId: string;
  bridgeSessionId: string;
  sequence: number;
  distanceCm: number | null;
  validDistance: boolean;
  receivedAt: string | null;
  sourceMode: "hardware" | "simulation" | "replay";
};
export type Condition = {
  zoneId: string;
  activity: "unknown" | "clear" | "some" | "sustained";
  sourceMode: "hardware" | "simulation" | "replay";
  receivedAt: string | null;
  distanceCm: number | null;
};
export type ReportPayload = {
  id: string;
  placeId: string;
  category: "obstruction" | "entrance" | "elevator" | "other";
  details: string;
  contributor: string;
  source: "community";
  reportedAt: string;
  reviewStatus: "pending";
};
export type PhotoCandidate = {
  kind: "stairs" | "ramp" | "signage" | "entrance" | "elevator" | "bench";
  confidence: "possible";
};
export type PhotoDraft = {
  candidates: PhotoCandidate[];
  draft: string;
  missingDetails: string[];
  uncertainty: string;
  source: "Gemini";
  model: string;
};
export type Route = {
  id: string;
  nodes: string[];
  edges: Edge[];
  distanceM: number;
  seconds: number;
  hasStairs: boolean;
  hasBench: boolean;
  reasons: string[];
};
export type ConditionsResponse = {
  condition: Condition | null;
  fresh: boolean;
  summary: {
    activity: Condition["activity"];
    medianCm: number | null;
    occupiedFraction: number | null;
    quality: number;
    validSamples: number;
    totalSamples: number;
  } | null;
  recent: SensorPayload[];
  deviceId?: string;
  zones?: Array<{
    deviceId: string;
    zoneId: string;
    condition: Condition | null;
    fresh: boolean;
    summary: ConditionsResponse["summary"];
  }>;
};
export type PreferenceSuggestion = {
  key: keyof Omit<Profile, "minWidthCm">;
  evidence: string;
};
export type OutputChoice = "text" | "speech";
export type PairedSession = {
  id: string;
  nodeId: "beacon-a";
  profileSlot: "A" | "B";
  profile: Profile;
  destination: string;
  outputChoice: OutputChoice;
  expiresAt: string;
};
export type NodeCommand = {
  id: string;
  pairingId: string;
  nodeId: "beacon-a";
  code: "AT_DESTINATION" | "GO_TO_HALL" | "USE_ELEVATOR_A" | "USE_ELEVATOR_B" | "USE_STAIRS" | "CONTINUE";
  routeId: string;
  createdAt: string;
  expiresAt: string;
  controllerStatus: "queued" | "received" | "rejected";
  acknowledgedAt: string | null;
  actuatorExecuted: false;
};
export type PhoneGuidance = {
  headline: string;
  detail: string;
  routeId: string | null;
  textDirections: string[];
};
