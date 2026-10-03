import type { Graph, Profile, Route, Condition, Edge } from "./types";
import { currentActivity } from "./conditions";
export const DEFAULT_WEIGHTS = {
  travelTime: 1,
  walking: 2,
  someActivity: 20,
  sustainedActivity: 70,
  dimLighting: 60,
  difficultSurface: 45,
  withoutRest: 40,
};
export type RoutingOptions = {
  now?: number;
  weights?: Partial<typeof DEFAULT_WEIGHTS>;
};
function weightsFor(options: RoutingOptions) {
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  if (
    Object.values(weights).some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error("Route weights must be finite and nonnegative.");
  return weights;
}
export function edgeAllowed(edge: Edge, profile: Profile) {
  return (
    !edge.closed &&
    !(profile.noStairs && edge.stairs) &&
    (profile.minWidthCm === null ||
      (Number.isFinite(profile.minWidthCm) &&
        profile.minWidthCm > 0 &&
        edge.widthCm !== null &&
        Number.isFinite(edge.widthCm) &&
        edge.widthCm >= profile.minWidthCm)) &&
    Number.isFinite(edge.seconds) &&
    edge.seconds >= 0 &&
    Number.isFinite(edge.lengthM) &&
    edge.lengthM >= 0
  );
}
export function findRoute(
  graph: Graph,
  start: string,
  destination: string,
  profile: Profile,
  ease: boolean,
  condition?: Condition,
  options: RoutingOptions = {},
): Route | null {
  const weights = weightsFor(options);
  const activity = currentActivity(condition, options.now ?? Date.now());
  if (
    !graph.nodes.some((n) => n.id === start) ||
    !graph.nodes.some((n) => n.id === destination)
  )
    return null;
  const costs = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, Edge>();
  const remaining = new Set(graph.nodes.map((n) => n.id));
  while (remaining.size) {
    const current = [...remaining].sort(
      (a, b) =>
        (costs.get(a) ?? Infinity) - (costs.get(b) ?? Infinity) ||
        a.localeCompare(b),
    )[0];
    if (!Number.isFinite(costs.get(current) ?? Infinity)) break;
    remaining.delete(current);
    if (current === destination) break;
    for (const edge of graph.edges
      .filter((e) => e.from === current)
      .sort((a, b) => a.id.localeCompare(b.id))) {
      if (!remaining.has(edge.to) || !edgeAllowed(edge, profile)) continue;
      let cost = edge.seconds * weights.travelTime;
      if (ease) {
        if (profile.lessWalking) cost += edge.lengthM * weights.walking;
        if (profile.quieter && edge.zoneId === condition?.zoneId)
          cost +=
            activity === "sustained"
              ? weights.sustainedActivity
              : activity === "some"
                ? weights.someActivity
                : 0;
        if (
          profile.resting &&
          ![edge.from, edge.to].some(
            (id) => graph.nodes.find((n) => n.id === id)?.kind === "bench",
          )
        )
          cost += weights.withoutRest;
        if (profile.avoidDim && edge.lighting === "dim")
          cost += weights.dimLighting;
        if (
          profile.smoother &&
          (edge.surface === "rough" || edge.surface === "gravel")
        )
          cost += weights.difficultSurface;
      }
      const next = costs.get(current)! + cost;
      if (next < (costs.get(edge.to) ?? Infinity)) {
        costs.set(edge.to, next);
        previous.set(edge.to, edge);
      }
    }
  }
  if (!costs.has(destination)) return null;
  const edges: Edge[] = [];
  let cursor = destination;
  while (cursor !== start) {
    const edge = previous.get(cursor);
    if (!edge) return null;
    edges.unshift(edge);
    cursor = edge.from;
  }
  const ids = [start, ...edges.map((e) => e.to)];
  const hasBench = ids.some(
    (id) => graph.nodes.find((n) => n.id === id)?.kind === "bench",
  );
  const reasons: string[] = [
    edges.some((e) => e.stairs) ? "Includes stairs" : "No stairs on this route",
  ];
  if (hasBench) reasons.push("Passes the recorded resting bench");
  if (activity === "sustained" || activity === "some")
    reasons.push(
      edges.some((e) => e.zoneId === condition?.zoneId)
        ? "Passes the zone with reported activity"
        : "Avoids the zone with reported activity",
    );
  if (profile.minWidthCm !== null && edges.length)
    reasons.push(
      `All path widths meet your ${profile.minWidthCm} cm requirement in the recorded data`,
    );
  const unknowns = [
    edges.some((e) => e.widthCm === null) && "widths",
    edges.some((e) => e.slopePercent === null) && "slopes",
    edges.some((e) => e.lighting === null) && "lighting",
    edges.some((e) => e.surface === null) && "surfaces",
  ].filter(Boolean);
  if (unknowns.length)
    reasons.push(
      `Unknown ${unknowns.join(", ")}; route access is not certified`,
    );
  if (profile.quieter && activity === "unknown")
    reasons.push("Activity is unknown; no quiet-route claim");
  return {
    id: ids.join("-"),
    nodes: ids,
    edges,
    distanceM: edges.reduce((a, e) => a + e.lengthM, 0),
    seconds: edges.reduce((a, e) => a + e.seconds, 0),
    hasStairs: edges.some((e) => e.stairs),
    hasBench,
    reasons,
  };
}
export function routeChoices(
  graph: Graph,
  start: string,
  destination: string,
  profile: Profile,
  condition?: Condition,
  options: RoutingOptions = {},
): Route[] {
  const resolved = { ...options, now: options.now ?? Date.now() };
  const direct = findRoute(
    graph,
    start,
    destination,
    profile,
    false,
    condition,
    resolved,
  );
  const ease = findRoute(
    graph,
    start,
    destination,
    profile,
    true,
    condition,
    resolved,
  );
  return [ease, direct].filter(
    (r, index, all): r is Route =>
      !!r && all.findIndex((a) => a?.id === r.id) === index,
  );
}
