import type { Profile, Route } from "./types";

export type RouteCatalog = { journeyKey: string; routes: Route[] };

// A live condition may change which path is preferred, but an already shown,
// valid path should not repeatedly disappear from the traveler's choices.
export function collectRouteOptions(
  previous: RouteCatalog,
  journeyKey: string,
  current: Route[],
): RouteCatalog {
  if (previous.journeyKey !== journeyKey)
    return { journeyKey, routes: current };
  const seen = new Set(previous.routes.map((route) => route.id));
  const added = current.filter((route) => !seen.has(route.id));
  return added.length
    ? { journeyKey, routes: [...previous.routes, ...added] }
    : previous;
}

// Card copy is based on the chosen path, never the live sensor state. The
// separate conditions panel carries changing activity and source status.
export function routeCardFacts(route: Route, profile: Profile): string[] {
  const zones = new Set(route.edges.map((edge) => edge.zoneId));
  const facts: string[] = [];
  if (zones.has("elevator-a-lobby")) facts.push("Via Elevator A lobby");
  if (zones.has("elevator-b-lobby")) facts.push("Via Elevator B lobby");
  if (profile.minWidthCm !== null && route.edges.length)
    facts.push(`Recorded widths meet your ${profile.minWidthCm} cm minimum`);
  const unknowns = [
    route.edges.some((edge) => edge.widthCm === null) && "widths",
    route.edges.some((edge) => edge.slopePercent === null) && "slopes",
    route.edges.some((edge) => edge.lighting === null) && "lighting",
    route.edges.some((edge) => edge.surface === null) && "surfaces",
  ].filter(Boolean);
  if (unknowns.length)
    facts.push(`Unknown ${unknowns.join(", ")}; route access is not certified`);
  return facts;
}
