import type { Route } from "./types";

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
