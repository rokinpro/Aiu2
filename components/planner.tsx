"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  MapPin,
  SlidersHorizontal,
  Footprints,
  Accessibility,
  Armchair,
  Volume2,
  Sun,
  Info,
  Flag,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { graph, nodes, defaultProfile } from "@/lib/demo";
import { useLiveConditions } from "./use-live-conditions";
import { ConditionsPanelView } from "./conditions-panel";
import NodePairing from "./node-pairing";
import PhotoAssist from "./photo-assist";
import { findRoute, routeChoices } from "@/lib/routing";
import { currentActivity } from "@/lib/conditions";
import { collectRouteOptions, routeCardFacts, type RouteCatalog } from "@/lib/route-display";
import type { Profile, ReportPayload, Route, PreferenceSuggestion } from "@/lib/types";
const labels: [keyof Omit<Profile, "minWidthCm">, string, React.ReactNode][] = [
  ["noStairs", "Avoid stairs", <Accessibility key="a" size={18} />],
  ["lessWalking", "Less walking", <Footprints key="b" size={18} />],
  ["quieter", "Prefer quieter areas", <Volume2 key="c" size={18} />],
  ["resting", "Prefer resting points", <Armchair key="d" size={18} />],
  ["avoidDim", "Avoid dim areas", <Sun key="e" size={18} />],
  ["smoother", "Prefer smoother paths", <Footprints key="f" size={18} />],
];
export default function Planner() {
  const [profile, setProfile] = useState(defaultProfile);
  const [start, setStart] = useState("entrance");
  const [destination, setDestination] = useState("classroom");
  const [floor, setFloor] = useState<1 | 2>(1);
  const [place, setPlace] = useState("a1");
  const [selected, setSelected] = useState<Route | null>(null);
  const [reports, setReports] = useState<ReportPayload[]>([]);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const demo = useLiveConditions();
  const [saving, setSaving] = useState(false);
  const [reportDetails, setReportDetails] = useState("");
  const [photoReset, setPhotoReset] = useState(0);
  const reportDetailsRef = useRef<HTMLTextAreaElement>(null);
  const [preferenceStatus, setPreferenceStatus] = useState(
    "Loading preferences…",
  );
  const [dismissed, setDismissed] = useState("");
  const [routeCatalog, setRouteCatalog] = useState<RouteCatalog>({ journeyKey: "", routes: [] });
  const [recommended, setRecommended] = useState({ journeyKey: "", id: "" });
  const [offered, setOffered] = useState({ journeyKey: "", id: "" });
  const [needsText, setNeedsText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [suggestions, setSuggestions] = useState<PreferenceSuggestion[] | null>(null);
  const [aiSource, setAiSource] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const profileResponse = await fetch("/api/preferences");
        if (!profileResponse.ok) throw new Error();
        const profileData = await profileResponse.json();
        if (!active) return;
        if (profileData.profile) {
          setProfile(profileData.profile);
          setSelected(null);
        }
        setLoaded(true);
        setPreferenceStatus("Preferences saved for your browser session.");
        const reportResponse = await fetch("/api/reports");
        if (!reportResponse.ok) throw new Error();
        const data = await reportResponse.json();
        if (active) setReports(data.reports);
      } catch {
        if (active)
          setPreferenceStatus("Storage unavailable. Changes are not saved.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        setPreferenceStatus("Preferences saved for your browser session.");
      } catch {
        if (!controller.signal.aborted)
          setPreferenceStatus(
            "Could not save preferences. Please try another change.",
          );
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [profile, loaded]);
  const journeyKey = JSON.stringify([start, destination, profile]);
  const conditions = demo.zones?.map((zone) => zone.condition)
    .filter((item): item is NonNullable<typeof item> => !!item) ??
    (demo.condition ? [demo.condition] : []);
  const activityKey = conditions.map((item) =>
    `${item.zoneId}:${currentActivity(item, demo.now)}`).join("|");
  // A new raw echo does not change a route. Recompute only when an effective
  // zone activity, journey endpoint, or explicit preference changes.
  const computed = useMemo(() => routeChoices(
    graph, start, destination, profile, conditions, { now: demo.now },
  // The activity key covers every sensor value used by routing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [journeyKey, activityKey]);
  const computedIds = computed.map((route) => route.id).join("|");
  useEffect(() => {
    setRouteCatalog((previous) => collectRouteOptions(previous, journeyKey, computed));
  // A route is added only when its identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyKey, computedIds]);
  const catalogRoutes = routeCatalog.journeyKey === journeyKey ? routeCatalog.routes : [];
  const choices = useMemo(() => {
    const currentById = new Map(computed.map((route) => [route.id, route]));
    const seen = new Set<string>();
    return [...catalogRoutes, ...computed].flatMap((route) => {
      if (seen.has(route.id)) return [];
      seen.add(route.id);
      const refreshed = currentById.get(route.id) ?? findRoute(
        { nodes: graph.nodes, edges: route.edges }, start, destination,
        profile, false, conditions, { now: demo.now },
      );
      return refreshed ? [refreshed] : [];
    });
  // The activity key covers all live routing facts; raw measurements do not.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogRoutes, computed, journeyKey, activityKey]);
  const active = selected
    ? choices.find((route) => route.id === selected.id) ?? choices[0]
    : choices[0];
  const candidateId = computed[0]?.id ?? "";
  useEffect(() => {
    if (recommended.journeyKey !== journeyKey) {
      setRecommended({ journeyKey, id: candidateId });
      return;
    }
    if (recommended.id === candidateId) return;
    const timer = setTimeout(() => setRecommended({ journeyKey, id: candidateId }), 3000);
    return () => clearTimeout(timer);
  }, [journeyKey, candidateId, recommended]);
  useEffect(() => {
    if (recommended.journeyKey === journeyKey && recommended.id &&
      active && recommended.id !== active.id)
      setOffered((previous) => previous.journeyKey === journeyKey && previous.id === recommended.id
        ? previous : { journeyKey, id: recommended.id });
  }, [journeyKey, recommended, active]);
  const suggestion = offered.journeyKey === journeyKey && active?.id !== offered.id
    ? choices.find((route) => route.id === offered.id) ?? null
    : null;
  const offerKey = `${journeyKey}:${suggestion?.id}`;
  useEffect(() => {
    if (!selected && active) setSelected(active);
  }, [selected, active]);
  const location = nodes.find((n) => n.id === place)!;
  function update(key: keyof Profile, value: boolean | number | null) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSelected(null);
  }
  function routeName(route: Route) {
    return route.nodes.includes("a1")
      ? "Via Elevator A"
      : route.nodes.includes("b1")
        ? "Via Elevator B"
        : route.hasStairs
          ? "Via the stairs"
          : "Direct connection";
  }
  return (
    <main id="main">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR CAMPUS, AT YOUR PACE</p>
          <h1>Where would you like to go?</h1>
          <p className="subtitle">
            Choose what works for you. We’ll help you find a way.
          </p>
        </div>
        <span className="building-label">
          <MapPin size={17} /> Campus building <span>· 2 floors</span>
        </span>
      </div>
      <p className="map-disclosure">
        Illustrative map · access measurements are unverified.
      </p>
      <nav className="feature-shortcuts" aria-label="Explore Aiu2 features">
        <a href="#journey"><Footprints size={20} aria-hidden="true" /><span><strong>Plan a route</strong><small>Choose what works for you</small></span><ChevronRight size={17} aria-hidden="true" /></a>
        <a href="#beacon"><Volume2 size={20} aria-hidden="true" /><span><strong>Connect the beacon</strong><small>Get a nearby cue</small></span><ChevronRight size={17} aria-hidden="true" /></a>
        <a href="/conditions"><MapPin size={20} aria-hidden="true" /><span><strong>Live conditions</strong><small>See sensor activity</small></span><ChevronRight size={17} aria-hidden="true" /></a>
        <a href="#report"><Flag size={20} aria-hidden="true" /><span><strong>Share an update</strong><small>Report what you notice</small></span><ChevronRight size={17} aria-hidden="true" /></a>
      </nav>
      <ConditionsPanelView compact live={demo} />
      <NodePairing />
      <div id="journey" className="workspace">
        <aside className="panel preferences">
          <div className="section-title">
            <h2>Your journey</h2>
            <span className="step">01</span>
          </div>
          <label className="field">
            Starting from
            <select
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setSelected(null);
              }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <div className="connection-dots">⋮</div>
          <label className="field">
            Going to
            <select
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setSelected(null);
              }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <div className="divider" />
          <div className="section-title">
            <h2>What matters today</h2>
            <SlidersHorizontal size={17} />
          </div>
          <p className="small muted">Your preferences, your choice.</p>
          <div className="ai-assist">
            <div className="ai-assist-title"><Sparkles size={17} /><strong>Tell us what helps</strong></div>
            <label htmlFor="needs-text" className="small muted">Describe your travel preferences in your own words.</label>
            <textarea
              id="needs-text"
              value={needsText}
              maxLength={500}
              rows={3}
              placeholder="I’d like to avoid stairs and stop at a bench."
              onChange={(event) => { setNeedsText(event.target.value); setSuggestions(null); setAiStatus(""); setAiSource(""); }}
            />
            <button className="ai-action" type="button" disabled={aiBusy || needsText.trim().length < 4} onClick={async () => {
              setAiBusy(true);
              setAiStatus("");
              setSuggestions(null);
              try {
                const response = await fetch("/api/preferences/interpret", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: needsText }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Could not interpret preferences.");
                setSuggestions(result.suggestions);
                setAiSource(result.source);
                if (!result.suggestions.length) setAiStatus("No clear preference found. Use the choices below.");
              } catch (error) {
                setAiStatus(error instanceof Error ? error.message : "Could not interpret that right now. Use the choices below.");
              } finally { setAiBusy(false); }
            }}>{aiBusy ? "Interpreting…" : "Suggest my preferences"} <ArrowRight size={16} /></button>
            {suggestions && suggestions.length > 0 && <div className="ai-review" aria-live="polite">
              <strong>Review these suggestions</strong>
              <p className="small muted">{aiSource}</p>
              <p className="small muted">Inferred from your words. Nothing changes until you apply them.</p>
              {suggestions.map((item) => <p key={item.key} className="ai-choice"><Check size={16} /> <span>{labels.find(([key]) => key === item.key)?.[1]}<small>“{item.evidence}”</small></span></p>)}
              <button className="ai-apply" type="button" onClick={() => {
                setProfile((previous) => ({ ...previous, ...Object.fromEntries(suggestions.map((item) => [item.key, true])) }));
                setSelected(null);
                setSuggestions(null);
                setAiStatus("Preferences applied. You can adjust any choice below.");
              }}>Apply these choices</button>
            </div>}
            {aiStatus && <p className="small" role="status">{aiStatus} {aiSource}</p>}
            <p className="small muted">Your text is sent to IBM when you ask for suggestions. You can always use the controls below.</p>
          </div>
          <div className="checks">
            {labels.map(([key, label, icon]) => (
              <label className="check-row" key={key}>
                {icon}
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={profile[key]}
                  onChange={(e) => update(key, e.target.checked)}
                />
              </label>
            ))}
          </div>
          <p className="small muted">
            Lighting and surfaces are unmeasured. These preferences apply when
            observations are available.
          </p>
          <details className="width-details">
            <summary>Minimum clear width</summary>
            <label className="field">
              Required width (cm)
              <input
                type="number"
                min="1"
                max="500"
                placeholder="No minimum"
                value={profile.minWidthCm ?? ""}
                onChange={(e) =>
                  update(
                    "minWidthCm",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </label>
            <p className="small muted">
              Unknown widths cannot meet a required minimum.
            </p>
          </details>
          <p className="local-note">
            <Check size={14} /> {preferenceStatus}
          </p>
        </aside>
        <section className="map-column">
          <div className="panel map-panel">
            <div className="map-toolbar">
              <div>
                <h2>Explore your route</h2>
                <p className="small muted">Schematic map · not to scale</p>
              </div>
              <div className="floor-controls" aria-label="Map floor">
                {([1, 2] as const).map((f) => (
                  <button
                    key={f}
                    aria-pressed={floor === f}
                    onClick={() => setFloor(f)}
                  >
                    Floor {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="map-surface">
              <svg
                viewBox="0 0 530 400"
                role="group"
                aria-label={`Schematic floor ${floor}. Equivalent route directions below.`}
              >
                <defs>
                  <pattern
                    id="grid"
                    width="22"
                    height="22"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="1" cy="1" r="1" fill="#dbe2dc" />
                  </pattern>
                </defs>
                <rect width="530" height="400" fill="url(#grid)" />
                <path
                  d="M40 45H480V355H40Z"
                  fill="#f6f7f2"
                  stroke="#d9e1d9"
                  strokeWidth="2"
                />
                <text x="65" y="65" className="map-caption">
                  {floor === 1 ? "GROUND FLOOR" : "UPPER FLOOR"}
                </text>
                {graph.edges
                  .filter(
                    (e) =>
                      nodes.find((n) => n.id === e.from)?.floor === floor &&
                      nodes.find((n) => n.id === e.to)?.floor === floor,
                  )
                  .map((e) => {
                    const a = nodes.find((n) => n.id === e.from)!,
                      b = nodes.find((n) => n.id === e.to)!;
                    return (
                      <line
                        key={e.id}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="#dbe1d8"
                        strokeWidth="19"
                        strokeLinecap="round"
                      />
                    );
                  })}
                {active?.edges
                  .filter(
                    (e) =>
                      nodes.find((n) => n.id === e.from)?.floor === floor &&
                      nodes.find((n) => n.id === e.to)?.floor === floor,
                  )
                  .map((e) => {
                    const a = nodes.find((n) => n.id === e.from)!,
                      b = nodes.find((n) => n.id === e.to)!;
                    return (
                      <line
                        key={e.id}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="#246b53"
                        strokeWidth="5"
                        strokeDasharray="9 6"
                      />
                    );
                  })}
                {nodes
                  .filter((n) => n.floor === floor)
                  .map((n) => (
                    <g
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${n.name}`}
                      onClick={() => setPlace(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setPlace(n.id);
                        }
                      }}
                      className="map-node"
                    >
                      <circle cx={n.x} cy={n.y} r="23" fill="transparent" />
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r="13"
                        fill={
                          active?.nodes.includes(n.id) ? "#175e4d" : "white"
                        }
                        stroke={place === n.id ? "#b36b20" : "#175e4d"}
                        strokeWidth={place === n.id ? 4 : 2}
                      />
                      <text
                        x={n.x}
                        y={n.y + 4}
                        textAnchor="middle"
                        fill={
                          active?.nodes.includes(n.id) ? "white" : "#175e4d"
                        }
                        fontSize="12"
                        fontWeight="700"
                      >
                        {n.kind === "elevator"
                          ? "↕"
                          : n.kind === "stairs"
                            ? "≋"
                            : n.kind === "bench"
                              ? "B"
                              : n.kind === "entrance"
                                ? "→"
                                : n.kind === "classroom"
                                  ? "✓"
                                  : "·"}
                      </text>
                      <text
                        x={n.x}
                        y={n.y + 35}
                        textAnchor="middle"
                        className="node-label"
                      >
                        {n.name
                          .replace(" · floor 1", "")
                          .replace(" · floor 2", "")}
                      </text>
                    </g>
                  ))}
              </svg>
              <span className="map-stamp">AIU2 / CAMPUS MAP</span>
            </div>
            <div className="map-legend">
              <span>
                <i className="legend-line" /> Selected route
              </span>
              <span>
                <i className="legend-dot" /> Place or landmark
              </span>
              <span>12 places · 2 sensor zones</span>
            </div>
          </div>
          <div className="routes-title">
            <h2>
              {choices.length === 1 ? "Your route" : "Your route options"}
            </h2>
            <span className="small muted">Based on today’s preferences</span>
          </div>
          <div className="route-grid" aria-live="polite">
            {choices.length === 0 ? (
              <div className="panel empty">
                <h3>No confirmed route found</h3>
                <p>
                  {profile.minWidthCm !== null
                    ? "No complete route has recorded widths meeting your minimum. Unknown widths cannot satisfy this requirement."
                    : "No connected path meets your current access requirements. Try another start or destination."}
                </p>
              </div>
            ) : (
              choices.map((r) => (
                <button
                  className={`route-card ${active?.id === r.id ? "selected" : ""}`}
                  key={r.id}
                  aria-pressed={active?.id === r.id}
                  onClick={() => {
                    setSelected(r);
                    if (offered.journeyKey === journeyKey && offered.id === r.id)
                      setDismissed(`${journeyKey}:${r.id}`);
                  }}
                >
                  <div className="route-top">
                    <span className="route-tag">
                      {active?.id === r.id
                        ? "YOUR SELECTED ROUTE"
                        : "ALTERNATE ROUTE"}
                    </span>
                    <span className="radio-dot">
                      {active?.id === r.id && <Check size={13} />}
                    </span>
                  </div>
                  <h3>{routeName(r)}</h3>
                  <p className="route-metric">
                    {Math.max(1, Math.ceil(r.seconds / 60))} <span>min</span>
                    <b>·</b>
                    {r.distanceM} <span>m</span>
                  </p>
                  <p className="small">
                    {r.hasStairs ? "Includes stairs" : "No stairs"}
                    {r.hasBench ? " · Resting bench on the way" : ""}
                  </p>
                  <div className="route-reasons">
                    {routeCardFacts(r, profile).map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
          {suggestion && dismissed !== offerKey && (
            <section
              className="route-offer"
              aria-label="Suggested route change"
              aria-live="polite"
            >
              <span className="demo-label">ANOTHER OPTION · YOUR CHOICE</span>
              <h2>A different route is available.</h2>
              <p>
                {routeName(suggestion)} is another way to reach your destination. {" "}
                {suggestion.distanceM >= active.distanceM
                  ? `${suggestion.distanceM - active.distanceM} m more`
                  : `${active.distanceM - suggestion.distanceM} m less`}{" "}
                walking, {Math.abs(suggestion.seconds - active.seconds)} seconds{" "}
                {suggestion.seconds >= active.seconds ? "longer" : "shorter"} in
                estimated travel time.
              </p>
              <p className="small">
                Your map and directions still follow{" "}
                {routeName(active).toLowerCase()}.
              </p>
              <div>
                <button
                  className="primary"
                  onClick={() => {
                    setSelected(suggestion);
                    setDismissed(offerKey);
                  }}
                >
                  Use this route <ArrowRight size={17} />
                </button>
                <button
                  className="keep-route"
                  onClick={() => setDismissed(offerKey)}
                >
                  Keep my route
                </button>
              </div>
            </section>
          )}
          {active && (
            <details className="panel directions" open>
              <summary>
                Step-by-step text directions <ArrowRight size={18} />
              </summary>
              {start === destination ? (
                <p>You’re at your selected destination.</p>
              ) : (
                <ol>
                  {active.edges.map((e) => {
                    const a = nodes.find((n) => n.id === e.from)!,
                      b = nodes.find((n) => n.id === e.to)!;
                    return (
                      <li key={e.id}>
                        {a.floor !== b.floor
                          ? `Take ${a.kind === "stairs" ? "the stairs" : a.name.split(" · ")[0]} to floor ${b.floor}.`
                          : `From ${a.name}, continue ${e.lengthM} metres to ${b.name}.`}
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="small muted">
                Planning only. Aiu2 does not track your indoor position or
                verify current elevator service.
              </p>
            </details>
          )}
        </section>
        <aside className="details-column">
          <section className="panel location">
            <p className="eyebrow">A CLOSER LOOK</p>
            <label className="field">
              Location details
              <select
                value={place}
                onChange={(e) => {
                  setPlace(e.target.value);
                  setFloor(nodes.find((n) => n.id === e.target.value)!.floor);
                }}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="location-icon">
              <MapPin size={26} />
            </div>
            <h2>{location.name}</h2>
            <p className="small muted">
              Floor {location.floor} · Unverified location
            </p>
            <p>{location.notes}</p>
            <dl>
              <div>
                <dt>Clear width</dt>
                <dd>Unknown</dd>
              </div>
              <div>
                <dt>Slope</dt>
                <dd>Unknown</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>Map seed</dd>
              </div>
              <div>
                <dt>Last verified</dt>
                <dd>Not verified</dd>
              </div>
            </dl>
            {place === "a1" && (
              <div className="sensor-note">
                <span className="status-dot" />
                <strong>Local activity: {demo.activity}</strong>
                <p className="small">
                  {demo.condition
                    ? `Source: ${demo.condition.sourceMode}`
                    : "Awaiting sensor readings."}
                </p>
              </div>
            )}
            {place === "b1" && (
              <div className="sensor-note">
                <span className="status-dot" />
                <strong>Local activity: {demo.zones?.find((zone) => zone.zoneId === "elevator-b-lobby")?.condition?.activity ?? "unknown"}</strong>
                <p className="small">{demo.zones?.find((zone) => zone.zoneId === "elevator-b-lobby")?.fresh ? "Receiving sensor readings." : "Awaiting sensor readings."}</p>
              </div>
            )}
            <a href="#report" className="text-link">
              Report an observation <ChevronRight size={16} />
            </a>
          </section>
          <div className="care-note">
            <Armchair size={23} />
            <h3>A route that fits you.</h3>
            <p>
              Access needs can change day to day. Adjust your choices whenever
              you need to.
            </p>
          </div>
        </aside>
      </div>
      <section id="report" className="panel report-section">
        <div>
          <p className="eyebrow">BETTER TOGETHER</p>
          <h2>Share what you notice.</h2>
          <p>
            A blocked corridor, a helpful entrance, a place to rest. Your
            observations can make the next journey easier.
          </p>
          <p className="small muted">
            Observations are saved on the server for your browser session,
            pending review. They do not change route access.
          </p>
          <Flag size={30} />
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            const details = String(data.get("details")).trim();
            if (!details) {
              setStatus("Please describe your observation.");
              return;
            }
            const report: ReportPayload = {
              id: crypto.randomUUID(),
              placeId: String(data.get("place")),
              category: data.get("category") as ReportPayload["category"],
              details,
              contributor:
                String(data.get("contributor")).trim() ||
                "Anonymous contributor",
              source: "community",
              reportedAt: new Date().toISOString(),
              reviewStatus: "pending",
            };
            setSaving(true);
            try {
              const response = await fetch("/api/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(report),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(result.error || "Could not save observation.");
              setReports((previous) =>
                [result.report, ...previous].slice(0, 50),
              );
              setStatus("Observation saved. Pending review.");
              form.reset();
              setReportDetails("");
              setPhotoReset((previous) => previous + 1);
            } catch (error) {
              setStatus(
                error instanceof Error
                  ? error.message
                  : "Unable to save. Please try again.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-row">
            <label className="field">
              Location
              <select name="place" defaultValue="a1">
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Type
              <select name="category">
                <option value="obstruction">Path obstruction</option>
                <option value="entrance">Entrance information</option>
                <option value="elevator">Elevator observation</option>
                <option value="other">Other observation</option>
              </select>
            </label>
          </div>
          <PhotoAssist key={photoReset} onUseDraft={(text) => {
            setReportDetails(text);
            reportDetailsRef.current?.focus();
          }} />
          <label className="field">
            What did you notice?
            <textarea
              ref={reportDetailsRef}
              name="details"
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              required
              maxLength={1000}
              rows={3}
              placeholder="Describe what you observed. Leave unknown measurements out."
            />
          </label>
          <div className="form-row">
            <label className="field">
              Name (optional)
              <input
                name="contributor"
                maxLength={80}
                placeholder="Anonymous contributor"
              />
            </label>
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save observation"} <ArrowRight size={17} />
            </button>
          </div>
          <p role="status" className="small">
            {status}
          </p>
        </form>
      </section>
      {reports.length > 0 && (
        <section className="panel saved-reports">
          <h2>Your observations</h2>
          {reports.map((r) => (
            <article key={r.id}>
              <strong>
                {nodes.find((n) => n.id === r.placeId)?.name} · Pending review
              </strong>
              <p>{r.details}</p>
              <p className="small muted">
                {r.contributor} · {new Date(r.reportedAt).toLocaleString()}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
