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
export type Route = {
  id: string;
  nodes: string[];
  edges: Edge[];
  distanceM: number;
  seconds: number;
  hasStairs: boolean;
  hasBench: boolean;
};
