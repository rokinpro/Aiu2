"use client";
import Link from "next/link";
import { Radio, ArrowUpRight } from "lucide-react";
import { useLiveConditions } from "./use-live-conditions";
export default function ConditionsPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const live = useLiveConditions();
  const age = live.condition?.receivedAt
    ? Math.max(
        0,
        Math.floor((live.now - Date.parse(live.condition.receivedAt)) / 1000),
      )
    : null;
  return (
    <section
      className={`live-panel ${compact ? "compact" : ""}`}
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
          {age !== null && age <= 5 ? "Receiving" : "No fresh data"}
        </span>
      </div>
      <div className="live-metrics">
        <div>
          <span>Raw distance</span>
          <strong>
            {live.condition?.distanceCm != null
              ? `${live.condition.distanceCm.toFixed(1)} cm`
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
      {compact ? (
        <Link href="/conditions" className="text-link">
          View conditions <ArrowUpRight size={15} />
        </Link>
      ) : (
        <>
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
            measurement quality.
          </p>
        </>
      )}
    </section>
  );
}
