"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Link2, Radio, Volume2 } from "lucide-react";
import { defaultProfile, nodes } from "@/lib/demo";
import type { NodeCommand, OutputChoice, PairedSession, PhoneGuidance, Profile } from "@/lib/types";

type Slot = "A" | "B";
type SlotSettings = { destination: string; profile: Profile; outputChoice: OutputChoice };
type PairingView = { session: PairedSession | null; command: NodeCommand | null; guidance: PhoneGuidance | null };
const initial: Record<Slot, SlotSettings> = {
  A: { destination: "classroom", profile: { ...defaultProfile }, outputChoice: "text" },
  B: { destination: "bench", profile: { ...defaultProfile, noStairs: false, resting: true }, outputChoice: "speech" },
};
const choices: Array<[keyof Omit<Profile, "minWidthCm">, string]> = [
  ["noStairs", "Avoid stairs"], ["lessWalking", "Less walking"],
  ["quieter", "Prefer quieter areas"], ["resting", "Prefer resting points"],
  ["avoidDim", "Avoid dim areas"], ["smoother", "Prefer smoother paths"],
];

export default function NodePairing() {
  const [slot, setSlot] = useState<Slot>("A");
  const [settings, setSettings] = useState(initial);
  const [code, setCode] = useState("");
  const [view, setView] = useState<PairingView>({ session: null, command: null, guidance: null });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch("/api/nodes/pairing", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json() as PairingView;
        if (!stopped) setView(data);
      } catch {
        if (!stopped) setMessage("Pairing status is unavailable. Check the app connection.");
      }
    }
    void refresh();
    const poll = setInterval(() => void refresh(), 1500);
    const clock = setInterval(() => setNow(Date.now()), 500);
    return () => { stopped = true; clearInterval(poll); clearInterval(clock); };
  }, []);
  function updateSlot(change: Partial<SlotSettings>) {
    setSettings((previous) => ({ ...previous, [slot]: { ...previous[slot], ...change } }));
  }
  async function pair() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/nodes/pairing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeCode: code.trim().toUpperCase(), profileSlot: slot, ...settings[slot] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not pair with the node.");
      setView({ session: data.session, command: null, guidance: null });
      setMessage(`Profile ${slot} paired. Guidance is ready on your phone; the controller command waits for a sensed approach.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not pair with the node.");
    } finally { setBusy(false); }
  }
  async function unpair() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/nodes/pairing", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setView({ session: null, command: null, guidance: null });
      setMessage("Disconnected from Elevator A.");
    } catch { setMessage("Could not disconnect. Try again."); }
    finally { setBusy(false); }
  }
  const selected = settings[slot];
  const session = view.session && Date.parse(view.session.expiresAt) > now ? view.session : null;
  const seconds = session && now ? Math.max(0, Math.min(180, Math.ceil((Date.parse(session.expiresAt) - now) / 1000))) : null;
  const command = view.command;
  const commandState = !command ? "Waiting for an approach" :
    command.controllerStatus === "received" ? "Controller received guidance" :
    command.controllerStatus === "rejected" ? "Controller rejected guidance" :
    Date.parse(command.expiresAt) <= now ? "Command expired before acknowledgement" :
    "Command sent; awaiting controller acknowledgement";
  function speak() {
    if (!view.guidance || !window.speechSynthesis) {
      setMessage("Speech is unavailable in this browser. Text directions remain below.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance([view.guidance.headline, ...view.guidance.textDirections].join(" "));
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
  return <section className="node-pairing" aria-label="Connect to Elevator A beacon">
    <div className="node-pairing-heading">
      <div className="node-emblem"><Link2 size={25} /></div>
      <div><p className="eyebrow">AT ELEVATOR A</p><h2>Guidance that follows your choices.</h2><p>Choose a profile, enter the code on the beacon, and connect one traveler at a time.</p></div>
      <span className="node-presence"><Radio size={15} /> {session ? "Paired" : "Ready to pair"}</span>
    </div>
    <div className="node-pairing-body">
      <div className="node-profile-editor">
        <div className="node-tabs" aria-label="Choose an editable profile">
          {(["A", "B"] as const).map((item) => <button key={item} type="button" aria-pressed={slot === item} onClick={() => setSlot(item)}>Profile {item}</button>)}
        </div>
        <p className="small muted">These profiles are choices you can change, not assumptions about anyone.</p>
        <label className="field">Destination
          <select value={selected.destination} onChange={(event) => updateSlot({ destination: event.target.value })}>
            {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </select>
        </label>
        <div className="node-choice-grid">
          {choices.map(([key, label]) => <label key={key} className="node-choice"><input type="checkbox" checked={selected.profile[key]} onChange={(event) => updateSlot({ profile: { ...selected.profile, [key]: event.target.checked } })} /><span>{label}</span></label>)}
        </div>
        <label className="field">Phone output
          <select value={selected.outputChoice} onChange={(event) => updateSlot({ outputChoice: event.target.value as OutputChoice })}>
            <option value="text">Text directions</option><option value="speech">Text + optional speech</option>
          </select>
        </label>
        <div className="node-pair-actions">
          <label className="field">Node code
            <input value={code} maxLength={8} autoComplete="off" placeholder="Code on beacon" onChange={(event) => setCode(event.target.value)} />
          </label>
          <button type="button" className="primary" disabled={busy || !code.trim()} onClick={() => void pair()}>{session ? `Pair profile ${slot}` : "Connect to node"} <ArrowRight size={17} /></button>
        </div>
      </div>
      <div className="node-guidance" aria-live="polite">
        {session ? <>
          <div className="node-guidance-top"><span className="node-connected"><Check size={15} /> Profile {session.profileSlot} connected</span><span>{seconds === null ? "Active" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} left`}</span></div>
          <h3>{view.guidance?.headline ?? "Preparing your directions…"}</h3>
          <p>{view.guidance?.detail ?? "Your choices are saved for this pairing."}</p>
          {view.guidance && <ol>{view.guidance.textDirections.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>}
          {session.outputChoice === "speech" && <button type="button" className="node-speak" onClick={speak}><Volume2 size={17} /> Read directions aloud</button>}
          <div className="controller-status"><Radio size={17} /><div><strong>{commandState}</strong><small>No buzzer or vibration actuator is connected; this is controller receipt only.</small></div></div>
          <button type="button" className="node-disconnect" disabled={busy} onClick={() => void unpair()}>Disconnect this phone</button>
        </> : <div className="node-empty"><Radio size={30} /><h3>Your next step, right here.</h3><p>Pair a profile to see personalized phone directions. The beacon never identifies someone from an ultrasonic reading.</p></div>}
        {message && <p className="small node-message" role="status">{message}</p>}
      </div>
    </div>
  </section>;
}
