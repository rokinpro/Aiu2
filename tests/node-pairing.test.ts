import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../lib/storage";
import { defaultProfile } from "../lib/demo";
import { guidanceFor } from "../lib/node-guidance";
import type { SensorPayload } from "../lib/types";

test("one opted-in pairing controls commands; retries, expiry and disconnect stay distinct from actuator execution", () => {
  const directory = mkdtempSync(join(tmpdir(), "aiu2-node-"));
  const store = openStore(join(directory, "test.sqlite"));
  const now = Date.parse("2026-10-03T18:00:00Z");
  const reading: SensorPayload = {
    deviceId: "beacon-a", zoneId: "elevator-a-lobby", bridgeSessionId: "hardware-session",
    sequence: 0, sourceMode: "hardware", distanceCm: 10, validDistance: true, receivedAt: null,
  };
  try {
    for (let i = 0; i < 26; i++) store.ingest({ ...reading, sequence: i }, now + i * 200);
    assert.equal(store.queueOnApproach(now + 5000), null, "unpaired presence cannot command the node");
    const input = { profileSlot: "A" as const, profile: defaultProfile, destination: "classroom", outputChoice: "text" as const };
    const session = store.pairNode("phone-one", input, now + 5000);
    assert.ok(session);
    assert.equal(store.pairNode("phone-two", input, now + 5001), null);
    const command = store.queueOnApproach(now + 5001);
    assert.ok(command);
    assert.equal(command.code, "USE_ELEVATOR_A");
    assert.equal(store.pendingCommand("beacon-a", now + 5002)?.id, command.id);
    assert.equal(store.queueOnApproach(now + 5002), null, "rate limit prevents repeated presence commands");
    const ack = store.acknowledgeCommand("beacon-a", command.id, "received", now + 5100);
    assert.equal(ack?.duplicate, false);
    assert.equal(ack?.command.controllerStatus, "received");
    assert.equal(ack?.command.actuatorExecuted, false);
    assert.equal(store.acknowledgeCommand("beacon-a", command.id, "received", now + 5200)?.duplicate, true);
    assert.equal(store.pendingCommand("beacon-a", now + 5200), null);
    const switched = store.pairNode("phone-one", {
      profileSlot: "B", profile: { ...defaultProfile, noStairs: false, resting: true },
      destination: "bench", outputChoice: "speech",
    }, now + 5300);
    assert.equal(switched?.profileSlot, "B");
    assert.equal(store.latestCommand("phone-one"), null, "old profile commands do not cross to the new pairing");
    assert.equal(store.acknowledgeCommand("beacon-a", command.id, "received", now + 5400), null);
    assert.equal(store.queueOnApproach(now + 11000), null, "USB silence makes presence stale");
    assert.equal(store.acknowledgeCommand("beacon-a", command.id, "received", now + 11000), null, "expired command cannot be acknowledged");
    assert.equal(store.unpairNode("phone-two"), false);
    assert.equal(store.unpairNode("phone-one"), true);
    assert.equal(store.getPairing("phone-one", now + 11000), null);
    assert.ok(store.pairNode("phone-two", input, now + 11000));
    assert.equal(store.getPairing("phone-two", now + 3 * 60 * 1000 + 11001), null);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("two editable profile choices give different phone guidance from the same node", () => {
  const a = {
    id: "one", nodeId: "beacon-a" as const, profileSlot: "A" as const,
    profile: defaultProfile, destination: "classroom", outputChoice: "text" as const,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  const b = {
    ...a, id: "two", profileSlot: "B" as const, destination: "bench",
    profile: { ...defaultProfile, noStairs: false, resting: true }, outputChoice: "speech" as const,
  };
  const first = guidanceFor(a);
  const second = guidanceFor(b);
  assert.equal(first.code, "USE_ELEVATOR_A");
  assert.equal(second.code, "GO_TO_HALL");
  assert.notDeepEqual(first.phone.textDirections, second.phone.textDirections);
  assert.ok(first.phone.detail.includes("No stairs"));
});
