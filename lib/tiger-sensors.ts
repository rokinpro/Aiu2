import pg from "pg";
import type { Reading } from "./sensor-processing";

const { Pool } = pg;
type TigerRuntime = typeof globalThis & {
  aiu2TigerPool?: pg.Pool;
  aiu2TigerPoolUrl?: string;
  aiu2TigerSchema?: Promise<void>;
};
const runtime = globalThis as TigerRuntime;
let lastWarningAt = 0;

function pool() {
  if (!process.env.DATABASE_URL) return null;
  const connection = new URL(process.env.DATABASE_URL);
  // Tiger supplies libpq's sslmode=require. Match that TLS behavior in pg.
  if (connection.searchParams.get("sslmode") === "require")
    connection.searchParams.set("uselibpqcompat", "true");
  const connectionString = connection.toString();
  if (runtime.aiu2TigerPool && runtime.aiu2TigerPoolUrl !== connectionString) {
    void runtime.aiu2TigerPool.end();
    runtime.aiu2TigerPool = undefined;
    runtime.aiu2TigerSchema = undefined;
  }
  if (!runtime.aiu2TigerPool) {
    runtime.aiu2TigerPool = new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 1500,
      idleTimeoutMillis: 10000,
    });
    runtime.aiu2TigerPoolUrl = connectionString;
    runtime.aiu2TigerPool.on("error", () => warnOnce());
  }
  return runtime.aiu2TigerPool;
}

function warnOnce() {
  if (Date.now() - lastWarningAt < 30000) return;
  lastWarningAt = Date.now();
  console.warn("Tiger sensor history is temporarily unavailable; local live readings continue.");
}

async function ensureSchema(client: pg.Pool) {
  if (!runtime.aiu2TigerSchema) {
    runtime.aiu2TigerSchema = client.query(`
      CREATE TABLE IF NOT EXISTS aiu2_sensor_readings (
        device_id TEXT NOT NULL,
        zone_id TEXT NOT NULL,
        bridge_session_id TEXT NOT NULL,
        sequence BIGINT NOT NULL,
        source_mode TEXT NOT NULL,
        distance_cm DOUBLE PRECISION,
        valid_distance BOOLEAN NOT NULL,
        received_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (device_id, bridge_session_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS aiu2_sensor_readings_recent
        ON aiu2_sensor_readings (device_id, received_at DESC);
    `).then(() => undefined).catch((error: unknown) => {
      runtime.aiu2TigerSchema = undefined;
      throw error;
    });
  }
  await runtime.aiu2TigerSchema;
}

export async function archiveSensorReading(reading: Reading) {
  const client = pool();
  if (!client) return;
  try {
    await ensureSchema(client);
    await client.query(`
      INSERT INTO aiu2_sensor_readings
        (device_id, zone_id, bridge_session_id, sequence, source_mode,
         distance_cm, valid_distance, received_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (device_id, bridge_session_id, sequence) DO NOTHING
    `, [reading.deviceId, reading.zoneId, reading.bridgeSessionId,
      reading.sequence, reading.sourceMode, reading.distanceCm,
      reading.validDistance, reading.receivedAt]);
  } catch {
    warnOnce();
  }
}

export async function sensorArchiveSummary() {
  const client = pool();
  if (!client) return null;
  await ensureSchema(client);
  const result = await client.query<{
    device_id: string;
    zone_id: string;
    source_mode: string;
    reading_count: string;
    last_received_at: Date;
  }>(`
    SELECT device_id, MAX(zone_id) AS zone_id, source_mode,
      COUNT(*)::text AS reading_count, MAX(received_at) AS last_received_at
    FROM aiu2_sensor_readings
    GROUP BY device_id, source_mode
    ORDER BY device_id, source_mode
  `);
  return result.rows.map((row) => ({
    deviceId: row.device_id,
    zoneId: row.zone_id,
    sourceMode: row.source_mode,
    readingCount: Number(row.reading_count),
    lastReceivedAt: row.last_received_at.toISOString(),
  }));
}
