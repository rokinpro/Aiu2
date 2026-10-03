"use client";
import Link from "next/link";
import { Radio, ArrowUpRight } from "lucide-react";
import { useLiveConditions } from "./use-live-conditions";
export default function ConditionsPanel({ compact = false }: { compact?: boolean }) {
  const live = useLiveConditions();
  return <ConditionsPanelView compact={compact} live={live} />;
}
export function ConditionsPanelView({
  compact = false,
  live,
}: {
  compact?: boolean;
  live: ReturnType<typeof useLiveConditions>;
}) {
  const received = Date.parse(live.condition?.receivedAt ?? "");
  const ageMs = live.now > 0 && Number.isFinite(received) && live.now >= received
    ? live.now - received : null;
  const age = ageMs === null ? null : Math.floor(ageMs / 1000);
  const fresh = ageMs !== null && ageMs <= 5000;
  if (compact) {
    const status = live.activity === "clear" ? "low"
      : live.activity === "some" || live.activity === "sustained" ? "presence"
        : "checking";
    return <section className="live-panel compact" aria-label="Elevator A conditions">
      <div className="live-heading">
        <Radio size={23} aria-hidden="true" />
        <div><p className="eyebrow">ELEVATOR A · FLOOR 1</p><h2>Local activity</h2></div>
      </div>
      <div className="activity-scale" role="group" aria-label={`Current sensor state: ${status}`}>
        {(["low", "presence", "checking"] as const).map((item) => <div
          key={item}
          className={`activity-state ${item} ${status === item ? "active" : ""}`}
          aria-current={status === item ? "true" : undefined}
        ><span aria-hidden="true" />{item === "low" ? "Low activity" : item === "presence" ? "Presence" : "Checking"}</div>)}
      </div>
      <p className="small muted">Presence indicator only. It does not confirm an obstruction or elevator service.</p>
      <Link href="/conditions" className="text-link">View live readings <ArrowUpRight size={15} /></Link>
    </section>;
  }
  return (
    <section
      className="live-panel"
      aria-label="Elevator A conditions"
    >
      <div className="live-heading">
        <Radio size={23} />
        <div>
          <p className="eyebrow">ELEVATOR A · FLOOR 1</p>
          <h2>
            {live.activity === "unknown"
              ? "Waiting for reliable readings"
              : live.activity === "sustained"
                ? "Sustained activity nearby"
                : live.activity === "some"
                  ? "Some activity nearby"
                  : "Low activity nearby"}
          </h2>
        </div>
        <span className={`live-badge ${live.activity}`}>
          {fresh ? "Receiving" : "No fresh data"}
        </span>
      </div>
      <div className="live-metrics">
        <div>
          <span>Raw distance</span>
          <strong>
            {live.displayDistanceCm != null
              ? `${live.displayDistanceCm.toFixed(1)} cm`
              : "—"}
          </strong>
        </div>
        <div>
          <span>Valid readings</span>
          <strong>
            {live.summary ? `${Math.round(live.summary.quality * 100)}%` : "—"}
          </strong>
        </div>
        <div>
          <span>Last received</span>
          <strong>{age === null ? "Not yet" : `${age}s ago`}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{live.condition?.sourceMode ?? "Not connected"}</strong>
        </div>
      </div>
      <p className="small muted" role="status">
        {live.error ||
          "Presence estimate only. Activity does not confirm an obstruction or elevator service."}
      </p>
        <>
          <div className="sensor-zone-list" aria-label="Sensor zones">
            {(live.zones ?? []).map((zone) => <div key={zone.zoneId}>
              <strong>{zone.zoneId === "elevator-a-lobby" ? "Elevator A lobby" : "Elevator B lobby"}</strong>
              <span>{zone.fresh ? `${zone.condition?.activity ?? "unknown"} activity · ${zone.summary?.medianCm?.toFixed(1) ?? "—"} cm median` : "No fresh data"}</span>
            </div>)}
          </div>
          <dl>
            <div>
              <dt>Median filtered distance</dt>
              <dd>
                {live.summary?.medianCm?.toFixed(1) ?? "Unknown"}
                {live.summary?.medianCm != null ? " cm" : ""}
              </dd>
            </div>
            <div>
              <dt>Occupied fraction · last 10 seconds</dt>
              <dd>
                {live.summary?.occupiedFraction != null
                  ? `${Math.round(live.summary.occupiedFraction * 100)}%`
                  : "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Valid / total readings in window</dt>
              <dd>
                {live.summary
                  ? `${live.summary.validSamples} / ${live.summary.totalSamples}`
                  : "0 / 0"}
              </dd>
            </div>
          </dl>
          <p className="small muted">
            Three consecutive one-second classifications confirm a change.
            Readings older than five seconds are unknown. Invalid echoes lower
            measurement quality. The raw distance display holds isolated small
            changes to stay readable.
          </p>
        </>
    </section>
  );
}
