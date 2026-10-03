import test from "node:test";
import assert from "node:assert/strict";
import { graph, defaultProfile } from "../lib/demo";
import { findRoute, routeChoices } from "../lib/routing";
import type { Condition } from "../lib/types";
test("demo contains 12 places, 25 valid directed edges and one zone", () => {
  assert.equal(graph.nodes.length, 12);
  assert.equal(graph.edges.length, 25);
  assert.deepEqual(
    [...new Set(graph.edges.map((e) => e.zoneId).filter(Boolean))],
    ["elevator-a-lobby"],
  );
  for (const e of graph.edges) {
    assert.ok(graph.nodes.some((n) => n.id === e.from));
    assert.ok(graph.nodes.some((n) => n.id === e.to));
    assert.equal(e.widthCm, null);
    assert.equal(e.slopePercent, null);
  }
});
test("no stairs is a hard requirement for every pair", () => {
  for (const a of graph.nodes)
    for (const b of graph.nodes) {
      const r = findRoute(graph, a.id, b.id, defaultProfile, false);
      assert.ok(!r?.hasStairs);
    }
});
test("allowing stairs enables a shorter journey", () => {
  const r = findRoute(
    graph,
    "entrance",
    "classroom",
    { ...defaultProfile, noStairs: false },
    false,
  );
  assert.ok(r?.hasStairs);
});
test("unknown widths cannot satisfy a required minimum", () => {
  assert.equal(
    findRoute(
      graph,
      "entrance",
      "classroom",
      { ...defaultProfile, minWidthCm: 90 },
      false,
    ),
    null,
  );
});
test("unreachable and invalid destinations return no route", () => {
  assert.equal(
    findRoute(
      { ...graph, edges: [] },
      "entrance",
      "classroom",
      defaultProfile,
      false,
    ),
    null,
  );
  assert.equal(
    findRoute(graph, "missing", "classroom", defaultProfile, false),
    null,
  );
});
test("duplicate choices collapse and same-place journey has no edges", () => {
  assert.equal(
    routeChoices(graph, "entrance", "classroom", defaultProfile).length,
    1,
  );
  assert.equal(
    findRoute(graph, "entrance", "entrance", defaultProfile, false)?.edges
      .length,
    0,
  );
});
test("closed links excluded and direction respected", () => {
  const g = {
    ...graph,
    edges: graph.edges.filter((e) => e.from === "entrance" && e.to === "hall"),
  };
  assert.ok(findRoute(g, "entrance", "hall", defaultProfile, false));
  assert.equal(findRoute(g, "hall", "entrance", defaultProfile, false), null);
  assert.equal(
    findRoute(
      { ...g, edges: g.edges.map((e) => ({ ...e, closed: true })) },
      "entrance",
      "hall",
      defaultProfile,
      false,
    ),
    null,
  );
});
test("fresh sustained activity offers B while stale activity does not claim quiet", () => {
  const c: Condition = {
    zoneId: "elevator-a-lobby",
    activity: "sustained",
    sourceMode: "simulation",
    receivedAt: new Date().toISOString(),
    distanceCm: 20,
  };
  assert.ok(
    routeChoices(
      graph,
      "entrance",
      "classroom",
      defaultProfile,
      c,
    )[0].nodes.includes("b1"),
  );
  assert.equal(
    routeChoices(graph, "entrance", "classroom", defaultProfile, {
      ...c,
      receivedAt: new Date(Date.now() - 6000).toISOString(),
    }).length,
    1,
  );
});
test("resting preference favors the bench and preserves direct alternative", () => {
  const routes = routeChoices(graph, "entrance", "classroom", {
    ...defaultProfile,
    resting: true,
  });
  assert.ok(routes[0].hasBench);
  assert.equal(routes.length, 2);
});

test("zone changes require three consecutive samples; stale and future readings are unknown", async () => {
  const { advanceActivity, currentActivity } =
    await import("../lib/conditions");
  let state = {
    candidate: "unknown",
    count: 0,
    activity: "unknown",
  } as import("../lib/conditions").Stability;
  state = advanceActivity(state, "sustained");
  state = advanceActivity(state, "sustained");
  assert.equal(state.activity, "unknown");
  state = advanceActivity(state, "clear");
  assert.equal(state.count, 1);
  state = advanceActivity(state, "sustained");
  state = advanceActivity(state, "sustained");
  state = advanceActivity(state, "sustained");
  assert.equal(state.activity, "sustained");
  const now = Date.parse("2026-10-03T18:00:00Z");
  const condition: Condition = {
    zoneId: "elevator-a-lobby",
    activity: "sustained",
    sourceMode: "simulation",
    receivedAt: new Date(now).toISOString(),
    distanceCm: 20,
  };
  assert.equal(currentActivity(condition, now + 5001), "unknown");
  assert.equal(currentActivity(condition, now - 1), "unknown");
  assert.equal(
    routeChoices(graph, "entrance", "classroom", defaultProfile, condition, {
      now,
    })[0].nodes.includes("b1"),
    true,
  );
});

test("lighting and surface weights favor recorded comfortable alternatives without treating unknowns as facts", () => {
  const recorded = {
    ...graph,
    edges: graph.edges.map((e) => ({
      ...e,
      lighting: e.zoneId ? ("dim" as const) : null,
      surface: e.zoneId ? "rough" : null,
    })),
  };
  for (const preference of [{ avoidDim: true }, { smoother: true }]) {
    const options = routeChoices(recorded, "entrance", "classroom", {
      ...defaultProfile,
      ...preference,
    });
    assert.ok(options[0].nodes.includes("b1"));
    assert.equal(options.length, 2);
    assert.ok(options[0].reasons.some((r) => r.includes("Unknown")));
  }
});

test("weights are configurable and nonnegative; zero-cost cycles terminate deterministically", () => {
  assert.throws(
    () =>
      routeChoices(graph, "entrance", "classroom", defaultProfile, undefined, {
        weights: { travelTime: -1 },
      }),
    /nonnegative/,
  );
  const zero = { weights: { travelTime: 0 } };
  const first = routeChoices(
    graph,
    "entrance",
    "classroom",
    defaultProfile,
    undefined,
    zero,
  );
  const reordered = routeChoices(
    {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    },
    "entrance",
    "classroom",
    defaultProfile,
    undefined,
    zero,
  );
  assert.deepEqual(first, reordered);
  assert.ok(first[0].edges.length < graph.nodes.length);
});
