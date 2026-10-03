"use client";
import { useEffect, useState } from "react";
import { currentActivity } from "@/lib/conditions";
import { advanceDisplayReading, EMPTY_DISPLAY_READING } from "@/lib/display-reading";
import type { ConditionsResponse } from "@/lib/types";
export function useLiveConditions() {
  const [data, setData] = useState<ConditionsResponse>({
    condition: null,
    summary: null,
    fresh: false,
    recent: [],
  });
  const [now, setNow] = useState(0);
  const [displayReading, setDisplayReading] = useState(EMPTY_DISPLAY_READING);
  const [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function poll() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch("/api/conditions", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!stopped) {
          setData(result);
          setDisplayReading((previous) => advanceDisplayReading(previous, result.condition, Date.now()));
          setError("");
        }
      } catch {
        if (!stopped) setError("Connection interrupted. Waiting to reconnect.");
      } finally {
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(poll, 1000);
      }
    }
    void poll();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(clock);
      controller?.abort();
    };
  }, []);
  return {
    ...data,
    condition: data.condition ?? undefined,
    now,
    error,
    activity: currentActivity(data.condition ?? undefined, now),
    displayDistanceCm: now > 0 && data.condition?.receivedAt &&
      now >= Date.parse(data.condition.receivedAt) &&
      now - Date.parse(data.condition.receivedAt) <= 5000
      ? displayReading.distanceCm
      : null,
  };
}
