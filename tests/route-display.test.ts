import test from "node:test";
import assert from "node:assert/strict";
import { graph, defaultProfile } from "../lib/demo";
import { routeChoices } from "../lib/routing";
import { collectRouteOptions, routeCardFacts } from "../lib/route-display";
import type { Condition } from "../lib/types";

test("route cards keep their order through changing sensor activity", () => {
  const now = Date.parse("2026-10-03T18:00:00Z");
  const condition: Condition = {
    zoneId: "elevator-a-lobby", activity: "clear", sourceMode: "hardware",
    receivedAt: new Date(now).toISOString(), distanceCm: 60,
  };
  const key = "entrance-classroom-no-stairs";
  const clear = routeChoices(graph, "entrance", "classroom", defaultProfile, condition, { now });
  const busy = routeChoices(graph, "entrance", "classroom", defaultProfile,
    { ...condition, activity: "sustained", distanceCm: 10 }, { now });
  let catalog = collectRouteOptions({ journeyKey: "", routes: [] }, key, clear);
  assert.equal(catalog.routes.length, 1);
  catalog = collectRouteOptions(catalog, key, busy);
  assert.deepEqual(catalog.routes.map((route) => route.id), [clear[0].id, busy[0].id]);
  assert.equal(collectRouteOptions(catalog, key, clear), catalog);
  assert.deepEqual(collectRouteOptions(catalog, "new journey", clear).routes, clear);
  const clearFacts = routeCardFacts(clear[0], defaultProfile);
  const busyFacts = routeCardFacts(busy.find((route) => route.id === clear[0].id)!, defaultProfile);
  assert.deepEqual(clearFacts, busyFacts);
  assert.ok(clearFacts.some((fact) => fact.includes("Unknown widths")));
  assert.ok(clearFacts.every((fact) => !fact.includes("activity")));
});

test("a resting preference may already select the route away from the monitored area", () => {
  const now = Date.parse("2026-10-03T18:00:00Z");
  const condition: Condition = {
    zoneId: "elevator-a-lobby", activity: "clear", sourceMode: "hardware",
    receivedAt: new Date(now).toISOString(), distanceCm: 60,
  };
  const profile = { ...defaultProfile, resting: true };
  const clear = routeChoices(graph, "entrance", "classroom", profile, condition, { now });
  const busy = routeChoices(graph, "entrance", "classroom", profile,
    { ...condition, activity: "sustained", distanceCm: 10 }, { now });
  assert.ok(clear[0].nodes.includes("b1"));
  assert.equal(busy[0].id, clear[0].id);
  assert.ok(!busy[0].edges.some((edge) => edge.zoneId === "elevator-a-lobby"));
});
