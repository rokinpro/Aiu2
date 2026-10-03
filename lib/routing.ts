import type { Graph, Profile, Route, Condition } from "./types";
export function findRoute(
  graph: Graph,
  start: string,
  destination: string,
  profile: Profile,
  ease: boolean,
  condition?: Condition,
): Route | null {
  if (
    !graph.nodes.some((n) => n.id === start) ||
    !graph.nodes.some((n) => n.id === destination)
  )
    return null;
  const costs = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, Graph["edges"][number]>();
  const remaining = new Set(graph.nodes.map((n) => n.id));
  while (remaining.size) {
    const current = [...remaining].sort(
      (a, b) => (costs.get(a) ?? Infinity) - (costs.get(b) ?? Infinity),
    )[0];
    if (!Number.isFinite(costs.get(current) ?? Infinity)) break;
    remaining.delete(current);
    if (current === destination) break;
    for (const e of graph.edges.filter((e) => e.from === current)) {
      if (
        e.closed ||
        (profile.noStairs && e.stairs) ||
        (profile.minWidthCm !== null &&
          (e.widthCm === null || e.widthCm < profile.minWidthCm))
      )
        continue;
      let cost = e.seconds + (profile.lessWalking ? e.lengthM * 2 : 0);
      if (ease) {
        if (
          profile.quieter &&
          condition?.activity === "sustained" &&
          e.zoneId === condition.zoneId &&
          condition.receivedAt &&
          Date.now() - Date.parse(condition.receivedAt) <= 5000
        )
          cost += 70;
        if (
          profile.resting &&
          ![e.from, e.to].some(
            (id) => graph.nodes.find((n) => n.id === id)?.kind === "bench",
          )
        )
          cost += 40;
        if (profile.avoidDim && e.lighting === "dim") cost += 60;
      }
      const next = costs.get(current)! + cost;
      if (next < (costs.get(e.to) ?? Infinity)) {
        costs.set(e.to, next);
        previous.set(e.to, e);
      }
    }
  }
  if (!costs.has(destination)) return null;
  const edges: Graph["edges"] = [];
  let cursor = destination;
  while (cursor !== start) {
    const e = previous.get(cursor);
    if (!e) return null;
    edges.unshift(e);
    cursor = e.from;
  }
  const ids = [start, ...edges.map((e) => e.to)];
  return {
    id: ids.join("-"),
    nodes: ids,
    edges,
    distanceM: edges.reduce((a, e) => a + e.lengthM, 0),
    seconds: edges.reduce((a, e) => a + e.seconds, 0),
    hasStairs: edges.some((e) => e.stairs),
    hasBench: ids.some(
      (id) => graph.nodes.find((n) => n.id === id)?.kind === "bench",
    ),
  };
}
export function routeChoices(
  graph: Graph,
  start: string,
  destination: string,
  profile: Profile,
  condition?: Condition,
): Route[] {
  const direct = findRoute(
    graph,
    start,
    destination,
    profile,
    false,
    condition,
  );
  const ease = findRoute(graph, start, destination, profile, true, condition);
  return [ease, direct].filter(
    (r, index, all): r is Route =>
      !!r && all.findIndex((a) => a?.id === r.id) === index,
  );
}
