import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Profile, ReportPayload, SensorPayload } from "./types";
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
    CREATE INDEX IF NOT EXISTS reports_owner ON reports(owner,created);`);
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
