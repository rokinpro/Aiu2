"use client";
import { useEffect, useState } from "react";
import type { Condition } from "@/lib/types";
import {
  advanceActivity,
  currentActivity,
  type Stability,
} from "@/lib/conditions";
export function useDemoCondition() {
  const [mode, setMode] = useState<"off" | "busy" | "clear" | "disconnected">(
    "off",
  );
  const [condition, setCondition] = useState<Condition>();
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stability: Stability = {
      candidate: "unknown",
      count: 0,
      activity: "unknown",
    };
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (mode !== "busy" && mode !== "clear") return;
      stability = advanceActivity(
        stability,
        mode === "busy" ? "sustained" : "clear",
      );
      setProgress(Math.min(3, stability.count));
      if (stability.count >= 3)
        setCondition({
          zoneId: "elevator-a-lobby",
          activity: stability.activity,
          sourceMode: "simulation",
          receivedAt: new Date(time).toISOString(),
          distanceCm: mode === "busy" ? 20 : 60,
        });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode]);
  function changeMode(next: typeof mode) {
    setProgress(0);
    setMode(next);
    if (next === "off") setCondition(undefined);
  }
  return {
    mode,
    changeMode,
    condition,
    progress,
    now,
    activity: currentActivity(condition, now),
  };
}
