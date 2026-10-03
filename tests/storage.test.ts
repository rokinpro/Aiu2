import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../lib/storage";
import { defaultProfile } from "../lib/demo";
import type { SensorPayload } from "../lib/types";

test("SQLite persists reports/preferences; ingestion deduplicates and expires without treating invalid echoes as clear", () => {
  const directory = mkdtempSync(join(tmpdir(), "aiu2-"));
  const path = join(directory, "test.sqlite");
  let store = openStore(path);
  const now = Date.parse("2026-10-03T18:00:00Z");
  const event: SensorPayload = {
    deviceId: "beacon-a",
    zoneId: "elevator-a-lobby",
    bridgeSessionId: "test",
    sequence: 0,
    sourceMode: "simulation",
    distanceCm: 20,
    validDistance: true,
    receivedAt: null,
  };
  try {
    store.saveProfile("owner", defaultProfile);
    const report = store.saveReport("owner", {
      placeId: "a1",
      category: "obstruction",
      details: "Test observation",
      contributor: "Test",
    });
    for (let i = 0; i < 26; i++)
      store.ingest({ ...event, sequence: i }, now + i * 200);
    assert.equal(store.conditions(now + 5000).condition?.activity, "sustained");
    const retry = store.ingest({ ...event, sequence: 25 }, now + 7000);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.reading.receivedAt, new Date(now + 5000).toISOString());
    assert.equal(store.conditions(now + 10001).condition?.activity, "unknown");
    assert.equal(store.conditions(now + 10001).fresh, false);
    // Invalid events count against quality, never as clear-space evidence.
    for (let i = 26; i < 66; i++)
      store.ingest(
        { ...event, sequence: i, validDistance: false, distanceCm: null },
        now + i * 200,
      );
    assert.equal(store.conditions(now + 13000).condition?.activity, "unknown");
    assert.ok(store.conditions(now + 13000).summary!.quality < 0.6);
    store.close();
    store = openStore(path);
    assert.deepEqual(store.getProfile("owner"), defaultProfile);
    assert.equal(store.getReports("owner")[0].id, report.id);
    assert.equal(store.getReports("other").length, 0);
    assert.equal(
      store.ingest({ ...event, sequence: 0 }, now + 20000).duplicate,
      true,
    );
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("median filter suppresses isolated echoes; sources stay separate and fresh hardware wins", async () => {
  const { summarize } = await import("../lib/sensor-processing");
  const now = Date.parse("2026-10-03T18:00:00Z");
  const base: SensorPayload = {
    deviceId: "beacon-a",
    zoneId: "elevator-a-lobby",
    bridgeSessionId: "unit",
    sequence: 0,
    sourceMode: "simulation",
    distanceCm: 60,
    validDistance: true,
    receivedAt: null,
  };
  const readings = [60, 60, 10, 60, 60].map((distanceCm, i) => ({
    ...base,
    distanceCm,
    sequence: i,
    receivedAt: new Date(now + i * 200).toISOString(),
  }));
  assert.equal(summarize(readings, now + 800).occupiedFraction, 0);
  assert.equal(summarize(readings, now + 800).medianCm, 60);
  const directory = mkdtempSync(join(tmpdir(), "aiu2-"));
  const store = openStore(join(directory, "test.sqlite"));
  try {
    store.ingest({ ...base, sourceMode: "hardware" }, now);
    store.ingest({ ...base, bridgeSessionId: "sim", sequence: 1 }, now + 1000);
    assert.equal(
      store.conditions(now + 1000).condition?.sourceMode,
      "hardware",
    );
    assert.equal(store.conditions(now + 1000).recent.length, 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("sensor zones retain separate windows and classification state", () => {
  const directory = mkdtempSync(join(tmpdir(), "aiu2-"));
  const store = openStore(join(directory, "test.sqlite"));
  const now = Date.parse("2026-10-03T18:00:00Z");
  const base: SensorPayload = {
    deviceId: "beacon-a", zoneId: "elevator-a-lobby", bridgeSessionId: "multi",
    sequence: 0, sourceMode: "hardware", distanceCm: 10, validDistance: true,
    receivedAt: null,
  };
  try {
    for (let i = 0; i < 26; i++) {
      store.ingest({ ...base, sequence: i }, now + i * 200);
      store.ingest({ ...base, deviceId: "beacon-b", zoneId: "elevator-b-lobby", distanceCm: 80, sequence: i }, now + i * 200);
    }
    const zones = store.conditions(now + 5000).zones;
    assert.equal(zones[0].condition?.activity, "sustained");
    assert.equal(zones[1].condition?.activity, "clear");
    assert.equal(zones[0].summary?.medianCm, 10);
    assert.equal(zones[1].summary?.medianCm, 80);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
