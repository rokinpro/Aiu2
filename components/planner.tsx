"use client";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { graph, nodes, defaultProfile } from "@/lib/demo";
import { routeChoices } from "@/lib/routing";
import type { Profile, ReportPayload, Route } from "@/lib/types";
const labels: [keyof Omit<Profile, "minWidthCm">, string, React.ReactNode][] = [
  ["noStairs", "Avoid stairs", <Accessibility key="a" size={18} />],
  ["lessWalking", "Less walking", <Footprints key="b" size={18} />],
  ["quieter", "Prefer quieter areas", <Volume2 key="c" size={18} />],
  ["resting", "Prefer resting points", <Armchair key="d" size={18} />],
  ["avoidDim", "Avoid dim areas", <Sun key="e" size={18} />],
];
export default function Planner() {
  const [profile, setProfile] = useState(defaultProfile);
  const [start, setStart] = useState("entrance");
  const [destination, setDestination] = useState("classroom");
  const [floor, setFloor] = useState<1 | 2>(1);
  const [place, setPlace] = useState("a1");
  const [selected, setSelected] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportPayload[]>([]);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("aiu2-profile") || "null");
      if (
        saved &&
        labels.every(([key]) => typeof saved[key] === "boolean") &&
        (saved.minWidthCm === null ||
          (typeof saved.minWidthCm === "number" && saved.minWidthCm > 0))
      )
        setProfile(saved);
      const items = JSON.parse(localStorage.getItem("aiu2-reports") || "[]");
      if (Array.isArray(items))
        setReports(
          items.filter(
            (r) =>
              r &&
              typeof r.details === "string" &&
              typeof r.reportedAt === "string" &&
              nodes.some((n) => n.id === r.placeId),
          ),
        );
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem("aiu2-profile", JSON.stringify(profile));
      } catch {}
  }, [profile, loaded]);
  const choices = routeChoices(graph, start, destination, profile);
  const active = choices.find((r) => r.id === selected) ?? choices[0];
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
          <MapPin size={17} /> Demo building <span>· 2 floors</span>
        </span>
      </div>
      <div className="notice">
        <Info size={18} />
        <p>
          <strong>A small map. A starting point.</strong> This is a fictional
          campus demo. Locations, distances and route times are illustrative;
          access measurements are unverified.
        </p>
      </div>
      <div className="workspace">
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
            <Check size={14} /> Preferences stay on this browser.
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
              <span className="map-stamp">AIU2 / DEMO MAP</span>
            </div>
            <div className="map-legend">
              <span>
                <i className="legend-line" /> Selected route
              </span>
              <span>
                <i className="legend-dot" /> Place or landmark
              </span>
              <span>12 places · 1 planned sensor</span>
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
                  The demo has no measured path widths. Review your width
                  requirement or choose another journey.
                </p>
              </div>
            ) : (
              choices.map((r, i) => (
                <button
                  className={`route-card ${active?.id === r.id ? "selected" : ""}`}
                  key={r.id}
                  aria-pressed={active?.id === r.id}
                  onClick={() => setSelected(r.id)}
                >
                  <div className="route-top">
                    <span className="route-tag">
                      {i === 0 ? "BEST FIT" : "DIRECT OPTION"}
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
                  <p className="small muted">
                    Demo estimates · widths and lighting unknown
                  </p>
                </button>
              ))
            )}
          </div>
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
                          : `From ${a.name}, continue ${e.lengthM} demo metres to ${b.name}.`}
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
              Floor {location.floor} · Demo location
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
                <dd>Demo seed</dd>
              </div>
              <div>
                <dt>Last verified</dt>
                <dd>Not verified</dd>
              </div>
            </dl>
            {place === "a1" && (
              <div className="sensor-note">
                <span className="status-dot" />
                <strong>Sensor not connected</strong>
                <p className="small">
                  One planned device. Activity is unknown.
                </p>
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
            Demo reports are saved only in this browser, pending review. They do
            not change route access.
          </p>
          <Flag size={30} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
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
            try {
              const next = [report, ...reports].slice(0, 50);
              localStorage.setItem("aiu2-reports", JSON.stringify(next));
              setReports(next);
              setStatus("Observation saved on this browser. Pending review.");
              e.currentTarget.reset();
            } catch {
              setStatus(
                "Unable to save. Browser storage may be full or disabled.",
              );
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
          <label className="field">
            What did you notice?
            <textarea
              name="details"
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
            <button className="primary" type="submit">
              Save observation <ArrowRight size={17} />
            </button>
          </div>
          <p role="status" className="small">
            {status}
          </p>
        </form>
      </section>
      {reports.length > 0 && (
        <section className="panel saved-reports">
          <h2>Your local observations</h2>
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
