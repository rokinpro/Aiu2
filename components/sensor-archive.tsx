"use client";
import { useEffect, useState } from "react";
import { Database } from "lucide-react";

type History = {
  status: "connected" | "not_configured" | "unavailable";
  devices: Array<{ deviceId: string; zoneId: string; sourceMode: string; readingCount: number; lastReceivedAt: string }>;
};

export default function SensorArchive() {
  const [history, setHistory] = useState<History | null>(null);
  useEffect(() => {
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch("/api/sensors/history", { cache: "no-store" });
        const data = await response.json() as History;
        if (!stopped) setHistory(data);
      } catch {
        if (!stopped) setHistory({ status: "unavailable", devices: [] });
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 15000);
    return () => { stopped = true; clearInterval(interval); };
  }, []);
  if (history?.status === "not_configured") return null;
  return <section className="panel sensor-archive" aria-label="Sensor history">
    <div className="sensor-archive-heading"><Database size={23} aria-hidden="true" />
      <div><p className="eyebrow">SENSOR HISTORY</p><h2>Tiger Cloud archive</h2></div>
      <span>{history?.status === "connected" ? "Connected" : history?.status === "unavailable" ? "Unavailable" : "Checking"}</span>
    </div>
    <p className="small muted">Accepted readings from each sensor are saved with their device, source and receipt time.</p>
    {history?.status === "connected" ? <div className="sensor-zone-list">
      {(["beacon-a", "beacon-b"] as const).map((id) => {
        const devices = history.devices.filter((item) => item.deviceId === id);
        return <div key={id}><strong>{id === "beacon-a" ? "Elevator A" : "Elevator B"}</strong>
          <span>{devices.length ? devices.map((device) => `${device.readingCount.toLocaleString()} ${device.sourceMode} reading${device.readingCount === 1 ? "" : "s"} saved`).join(" · ") : "No readings saved yet"}</span></div>;
      })}
    </div> : <p className="small muted">{history?.status === "unavailable" ? "History is temporarily unavailable. Live conditions continue locally." : "Connecting to sensor history…"}</p>}
  </section>;
}
