import { graph, nodes } from "./demo";
import { routeChoices } from "./routing";
import type { Condition, NodeCommand, PairedSession, PhoneGuidance } from "./types";

export function guidanceFor(session: PairedSession, conditions: Condition[] = [], now = Date.now()):
  { phone: PhoneGuidance; code: NodeCommand["code"] | null } {
  const destination = nodes.find((node) => node.id === session.destination);
  const route = routeChoices(graph, "a1", session.destination, session.profile, conditions, { now })[0];
  if (!destination || !route) return {
    phone: { headline: "No confirmed route", detail: "The recorded paths do not meet these choices. Adjust your destination or preferences on your phone.", routeId: null, textDirections: [] },
    code: null,
  };
  if (route.edges.length === 0) return {
    phone: { headline: "You’re at your destination", detail: "Elevator A lobby is your selected place.", routeId: route.id, textDirections: [] },
    code: "AT_DESTINATION",
  };
  const first = route.edges[0];
  const code: NodeCommand["code"] =
    first.to === "hall" ? "GO_TO_HALL" :
    first.to === "a2" ? "USE_ELEVATOR_A" :
    first.to === "b2" ? "USE_ELEVATOR_B" :
    first.to === "s2" ? "USE_STAIRS" : "CONTINUE";
  const textDirections = route.edges.map((edge) => {
    const from = nodes.find((node) => node.id === edge.from)!;
    const to = nodes.find((node) => node.id === edge.to)!;
    return from.floor !== to.floor
      ? `Take ${from.kind === "stairs" ? "the stairs" : from.name.split(" · ")[0]} to floor ${to.floor}.`
      : `From ${from.name}, continue ${edge.lengthM} metres to ${to.name}.`;
  });
  const minutes = Math.max(1, Math.ceil(route.seconds / 60));
  return {
    phone: {
      headline: `From Elevator A lobby to ${destination.name}`,
      detail: `${route.hasStairs ? "Includes stairs" : "No stairs"} · ${route.distanceM} metres · about ${minutes} ${minutes === 1 ? "minute" : "minutes"}. ${route.reasons.filter((reason) => reason.includes("Unknown")).join(" ")}`,
      routeId: route.id,
      textDirections,
    },
    code,
  };
}
