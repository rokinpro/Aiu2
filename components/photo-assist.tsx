"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Check, Sparkles } from "lucide-react";
import type { PhotoDraft } from "@/lib/types";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const kinds: Record<PhotoDraft["candidates"][number]["kind"], string> = {
  stairs: "Stairs", ramp: "Ramp", signage: "Signage", entrance: "Entrance",
  elevator: "Elevator", bench: "Bench",
};

export default function PhotoAssist({ onUseDraft }: { onUseDraft: (text: string) => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null; }, []);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  async function analyze() {
    if (!photo) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setDraft(null);
    setStatus("Looking for visible features…");
    try {
      const form = new FormData();
      form.set("photo", photo);
      const response = await fetch("/api/reports/photo", { method: "POST", body: form, signal: controller.signal });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || "Could not analyze this photo.");
      setDraft(result.draft as PhotoDraft);
      setStatus("Photo draft ready. Review every detail before adding it to your report.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(error instanceof Error ? error.message : "Could not analyze this photo. You can still write a report.");
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }
  return <div className="photo-assist">
    <div className="photo-assist-heading"><span className="photo-assist-icon"><Camera size={20} /></span><div><strong>Have a photo?</strong><p>Get a head start on your observation.</p></div></div>
    <label className="field">Choose a photo
      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          requestRef.current?.abort();
          requestRef.current = null;
          setBusy(false);
          setDraft(null);
          setPreview("");
          if (selected && selected.size > MAX_PHOTO_BYTES) {
            setPhoto(null);
            setStatus("Choose a photo under 4 MB.");
            event.target.value = "";
            return;
          }
          setPhoto(selected);
          setStatus("");
        }} />
    </label>
    <p className="small muted">JPEG, PNG, WebP, HEIC or HEIF · up to 4 MB. Your photo goes to Gemini only when you choose Analyze; Aiu2 does not save the image.</p>
    {photo && <div className="photo-assist-selection">
      {preview && <Image unoptimized src={preview} width={74} height={74} alt="Selected photo preview" />}
      <div><strong>{photo.name}</strong><span>{(photo.size / 1024 / 1024).toFixed(1)} MB selected</span></div>
    </div>}
    <button type="button" className="photo-assist-analyze" disabled={!photo || busy} onClick={() => void analyze()}><Sparkles size={17} /> {busy ? "Analyzing photo…" : "Analyze photo"}</button>
    <p role="status" className="small photo-assist-status">{status}</p>
    {draft && <div className="photo-draft">
      <div className="photo-draft-title"><Sparkles size={17} /><strong>Gemini photo draft</strong><span>Review before use</span></div>
      {draft.candidates.length ? <div className="photo-candidates">{draft.candidates.map((candidate) =>
        <div className="photo-candidate" key={candidate.kind}><strong>{kinds[candidate.kind]}</strong><span>Possibly visible</span></div>)}</div>
        : <p>No supported access features were clear in this image.</p>}
      <p className="photo-draft-copy">{draft.draft}</p>
      <p className="small muted">{draft.uncertainty}</p>
      <div className="photo-missing"><strong>Still needed from you</strong><ul>{draft.missingDetails.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <button type="button" className="photo-use-draft" onClick={() => { onUseDraft(draft.draft); setStatus("Draft added below. Edit it, choose the location and type, then save if accurate."); }}><Check size={17} /> Use as report draft</button>
    </div>}
  </div>;
}
