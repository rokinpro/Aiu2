import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Profile, ReportPayload, SensorPayload, PairedSession, NodeCommand } from "./types";
import { guidanceFor } from "./node-guidance";
import {
  INITIAL_STATE,
  advanceSummary,
  summarize,
  type Reading,
  type SensorState,
} from "./sensor-processing";
export function openStore(
  path = process.env.AIU2_DB_PATH || resolve("data/aiu2.sqlite"),
) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS readings (id INTEGER PRIMARY KEY, device TEXT NOT NULL, session TEXT NOT NULL, sequence INTEGER NOT NULL, mode TEXT NOT NULL, received TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(device,session,sequence));
    CREATE INDEX IF NOT EXISTS readings_recent ON readings(mode,id);
    CREATE TABLE IF NOT EXISTS sensor_state (mode TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS preferences (owner TEXT PRIMARY KEY, payload TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS reports_owner ON reports(owner,created);
    CREATE TABLE IF NOT EXISTS node_pairing (node TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, expires TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS node_pairing_owner ON node_pairing(owner,expires);
    CREATE TABLE IF NOT EXISTS node_commands (id TEXT PRIMARY KEY, pairing TEXT NOT NULL, node TEXT NOT NULL, payload TEXT NOT NULL, created TEXT NOT NULL, expires TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS node_commands_pending ON node_commands(node,expires,created);`);
  const rows = (device: string, mode: string, now: number): Reading[] =>
    (
      db
        .prepare(
          "SELECT payload FROM readings WHERE device=? AND mode=? AND received>=? ORDER BY id",
        )
        .all(device, mode, new Date(now - 10000).toISOString()) as { payload: string }[]
    ).map((r) => JSON.parse(r.payload));
  function conditionFor(deviceId: string, zoneId: string, now: number) {
    const latest = db
      .prepare(
        "SELECT payload FROM readings WHERE device=? ORDER BY CASE WHEN mode='hardware' AND received>=? THEN 0 ELSE 1 END, id DESC LIMIT 1",
      )
      .get(deviceId, new Date(now - 5000).toISOString()) as
      { payload: string } | undefined;
    if (!latest)
      return { deviceId, zoneId, condition: null, summary: null, fresh: false, recent: [] };
    const reading: Reading = JSON.parse(latest.payload);
    const recent = rows(deviceId, reading.sourceMode, now);
    const summary = summarize(
      recent,
      now,
      Number(process.env.AIU2_FOREGROUND_CM) || 30,
    );
    const saved = db
      .prepare("SELECT payload FROM sensor_state WHERE mode=?")
      .get(`${deviceId}:${reading.sourceMode}`) as { payload: string } | undefined;
    const state: SensorState = saved ? JSON.parse(saved.payload) : INITIAL_STATE;
    const fresh = now - Date.parse(reading.receivedAt) <= 5000;
    return {
      deviceId,
      zoneId,
      condition: {
        zoneId,
        activity: !fresh || summary.activity === "unknown" ? "unknown" : state.activity,
        sourceMode: reading.sourceMode,
        receivedAt: reading.receivedAt,
        distanceCm: reading.distanceCm,
      },
      summary,
      fresh,
      recent: recent.slice(-10),
    };
  }
  return {
    close: () => db.close(),
    ingest(input: SensorPayload, now = Date.now()) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const existing = db
          .prepare(
            "SELECT payload FROM readings WHERE device=? AND session=? AND sequence=?",
          )
          .get(input.deviceId, input.bridgeSessionId, input.sequence) as
          { payload: string } | undefined;
        if (existing) {
          db.exec("COMMIT");
          return {
            duplicate: true,
            reading: JSON.parse(existing.payload) as Reading,
          };
        }
        const reading: Reading = {
          ...input,
          receivedAt: new Date(now).toISOString(),
        };
        db.prepare(
          "INSERT INTO readings(device,session,sequence,mode,received,payload) VALUES(?,?,?,?,?,?)",
        ).run(
          input.deviceId,
          input.bridgeSessionId,
          input.sequence,
          input.sourceMode,
          reading.receivedAt,
          JSON.stringify(reading),
        );
        const saved = db
          .prepare("SELECT payload FROM sensor_state WHERE mode=?")
          .get(`${input.deviceId}:${input.sourceMode}`) as { payload: string } | undefined;
        const summary = summarize(
          rows(input.deviceId, input.sourceMode, now),
          now,
          Number(process.env.AIU2_FOREGROUND_CM) || 30,
        );
        const state = advanceSummary(
          saved ? JSON.parse(saved.payload) : INITIAL_STATE,
          summary,
          now,
        );
        db.prepare(
          "INSERT INTO sensor_state VALUES(?,?) ON CONFLICT(mode) DO UPDATE SET payload=excluded.payload",
        ).run(`${input.deviceId}:${input.sourceMode}`, JSON.stringify(state));
        db.exec("COMMIT");
        return { duplicate: false, reading };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    conditions(now = Date.now()) {
      const a = conditionFor("beacon-a", "elevator-a-lobby", now);
      const b = conditionFor("beacon-b", "elevator-b-lobby", now);
      return {
        condition: a.condition,
        summary: a.summary,
        fresh: a.fresh,
        recent: a.recent,
        deviceId: a.deviceId,
        zones: [a, b].map(({ deviceId, zoneId, condition, summary, fresh }) => ({
          deviceId, zoneId, condition, summary, fresh,
        })),
      };
    },
    getPairing(owner: string, now = Date.now()): PairedSession | null {
      const row = db.prepare("SELECT payload FROM node_pairing WHERE owner=? AND expires>?")
        .get(owner, new Date(now).toISOString()) as { payload: string } | undefined;
      return row ? JSON.parse(row.payload) as PairedSession : null;
    },
    pairNode(owner: string, input: Pick<PairedSession, "profileSlot" | "profile" | "destination" | "outputChoice">, now = Date.now()) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const current = db.prepare("SELECT owner,expires FROM node_pairing WHERE node='beacon-a'")
          .get() as { owner: string; expires: string } | undefined;
        if (current && Date.parse(current.expires) > now && current.owner !== owner) {
          db.exec("COMMIT");
          return null;
        }
        const session: PairedSession = {
          id: randomUUID(), nodeId: "beacon-a", ...input,
          expiresAt: new Date(now + 3 * 60 * 1000).toISOString(),
        };
        db.prepare("INSERT INTO node_pairing(node,owner,payload,expires) VALUES(?,?,?,?) ON CONFLICT(node) DO UPDATE SET owner=excluded.owner,payload=excluded.payload,expires=excluded.expires")
          .run("beacon-a", owner, JSON.stringify(session), session.expiresAt);
        db.exec("COMMIT");
        return session;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    unpairNode(owner: string) {
      return db.prepare("DELETE FROM node_pairing WHERE node='beacon-a' AND owner=?")
        .run(owner).changes > 0;
    },
    latestCommand(owner: string): NodeCommand | null {
      const row = db.prepare("SELECT c.payload FROM node_commands c JOIN node_pairing p ON p.node=c.node AND json_extract(p.payload,'$.id')=c.pairing WHERE p.owner=? ORDER BY c.created DESC LIMIT 1")
        .get(owner) as { payload: string } | undefined;
      return row ? JSON.parse(row.payload) as NodeCommand : null;
    },
    queueOnApproach(now = Date.now()): NodeCommand | null {
      const zone = conditionFor("beacon-a", "elevator-a-lobby", now);
      if (!zone.fresh || zone.condition?.sourceMode !== "hardware" ||
          !["some", "sustained"].includes(zone.condition.activity)) return null;
      const row = db.prepare("SELECT payload FROM node_pairing WHERE node='beacon-a' AND expires>?")
        .get(new Date(now).toISOString()) as { payload: string } | undefined;
      if (!row) return null;
      const session = JSON.parse(row.payload) as PairedSession;
      const conditions = this.conditions(now).zones.flatMap((item) => item.condition ? [item.condition] : []);
      const guidance = guidanceFor(session, conditions, now);
      if (!guidance.code || !guidance.phone.routeId) return null;
      const latest = db.prepare("SELECT payload FROM node_commands WHERE node='beacon-a' ORDER BY created DESC LIMIT 1")
        .get() as { payload: string } | undefined;
      if (latest && now - Date.parse((JSON.parse(latest.payload) as NodeCommand).createdAt) < 15000) return null;
      const command: NodeCommand = {
        id: randomUUID(), pairingId: session.id, nodeId: "beacon-a",
        code: guidance.code, routeId: guidance.phone.routeId,
        createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 5000).toISOString(),
        controllerStatus: "queued", acknowledgedAt: null, actuatorExecuted: false,
      };
      db.prepare("INSERT INTO node_commands VALUES(?,?,?,?,?,?)")
        .run(command.id, command.pairingId, command.nodeId, JSON.stringify(command), command.createdAt, command.expiresAt);
      return command;
    },
    pendingCommand(deviceId: string, now = Date.now()): NodeCommand | null {
      const row = db.prepare("SELECT c.payload FROM node_commands c JOIN node_pairing p ON p.node=c.node AND json_extract(p.payload,'$.id')=c.pairing WHERE c.node=? AND c.expires>? AND p.expires>? ORDER BY c.created LIMIT 1")
        .get(deviceId, new Date(now).toISOString(), new Date(now).toISOString()) as { payload: string } | undefined;
      const command = row ? JSON.parse(row.payload) as NodeCommand : null;
      return command?.controllerStatus === "queued" ? command : null;
    },
    acknowledgeCommand(deviceId: string, commandId: string, status: "received" | "rejected", now = Date.now()) {
      const row = db.prepare("SELECT c.payload FROM node_commands c JOIN node_pairing p ON p.node=c.node AND json_extract(p.payload,'$.id')=c.pairing WHERE c.id=? AND c.node=? AND c.expires>? AND p.expires>?")
        .get(commandId, deviceId, new Date(now).toISOString(), new Date(now).toISOString()) as { payload: string } | undefined;
      if (!row) return null;
      const command = JSON.parse(row.payload) as NodeCommand;
      if (command.controllerStatus !== "queued") return { command, duplicate: true };
      const updated: NodeCommand = {
        ...command, controllerStatus: status, acknowledgedAt: new Date(now).toISOString(),
        actuatorExecuted: false,
      };
      db.prepare("UPDATE node_commands SET payload=? WHERE id=?")
        .run(JSON.stringify(updated), commandId);
      return { command: updated, duplicate: false };
    },
    getProfile(owner: string): Profile | null {
      const row = db
        .prepare("SELECT payload FROM preferences WHERE owner=?")
        .get(owner) as { payload: string } | undefined;
      return row ? JSON.parse(row.payload) : null;
    },
    saveProfile(owner: string, profile: Profile) {
      db.prepare(
        "INSERT INTO preferences VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
      ).run(owner, JSON.stringify(profile), new Date().toISOString());
    },
    getReports(owner: string): ReportPayload[] {
      return (
        db
          .prepare(
            "SELECT payload FROM reports WHERE owner=? ORDER BY created DESC LIMIT 50",
          )
          .all(owner) as { payload: string }[]
      ).map((r) => JSON.parse(r.payload));
    },
    saveReport(
      owner: string,
      input: Pick<
        ReportPayload,
        "placeId" | "category" | "details" | "contributor"
      >,
    ) {
      const report: ReportPayload = {
        ...input,
        id: randomUUID(),
        source: "community",
        reportedAt: new Date().toISOString(),
        reviewStatus: "pending",
      };
      db.prepare("INSERT INTO reports VALUES(?,?,?,?)").run(
        report.id,
        owner,
        JSON.stringify(report),
        report.reportedAt,
      );
      return report;
    },
  };
}
let store: ReturnType<typeof openStore> | undefined;
export function getStore() {
  return (store ??= openStore());
}
