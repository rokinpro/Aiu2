# Aiu2

A campus accessibility companion: choose your needs, compare routes, inspect places and contribute observations. **Prompt 1 / app-first scaffold.** This is a fictional two-floor demo, not a verified campus navigation service.

## Run locally

Node.js 22.13+ and npm are recommended.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No credentials are needed. For production: `npm run build` then `npm start`. Run `npm test` for routing checks and `npm run typecheck` for TypeScript.

## What works

- Responsive journey planner with functional preferences, start/destination selection, clickable two-floor SVG map, location details and equivalent ordered text directions.
- 12 map places and 25 explicit directed edges. Elevator A, Elevator B, stairs, an automatic entrance, resting bench, restroom and classroom. A map place is not a hardware device.
- Deterministic Dijkstra routing. No-stairs and minimum-known-width constraints, closures, travel and walking costs, optional resting preference, and deduplicated route options. All distances/times are demo estimates; width, slope, surface and lighting are unknown.
- One sensor zone reserved at `elevator-a-lobby` for `beacon-a`. `/conditions` honestly shows no connection and unknown readings.
- Preferences and up to 50 pending observations persist in this browser's local storage. Reports include source, contributor and timestamp. They do not change the graph.
- Visible keyboard focus, labeled native form controls, large targets, reduced-motion support and text alternatives to map interactions.

Quieter-area and dim-area preferences are stored and the routing module supports those costs, but the demo has no condition feed or lighting measurements. The interface does not claim a route is quiet or bright. When direct and preferred paths match, only one card appears; choose “Prefer resting points” to compare the bench route with the direct elevator route.

## What is next

1. Confirm actual board and ultrasonic module labels before firmware/wiring.
2. Add server persistence for shared reports, validation and a controlled review action.
3. Add authenticated sensor ingestion, serial bridge, smoothing, deduplication and five-second stale detection. Connect the single physical sensor and prove its readings affect an offered route. Never switch an active journey without acceptance.
4. Add explicit pairing, short-lived commands and controller acknowledgements.
5. Add one reviewed AI feature, preferably IBM needs interpretation or report drafting after event eligibility and access are confirmed.

No AI provider, database, sensor ingestion, USB bridge, two-way commands, authentication or hosted app is connected. No synthetic hardware readings are presented. Unit tests exercise synthetic activity inputs only. The original project brief describes later stages; those embedded prompts are a roadmap, not completed features.

## Configuration

`.env.example` reserves empty, server-only placeholders for future integration. Copy to `.env.local` only when needed; never expose values with `NEXT_PUBLIC_` or commit secrets. The scaffold does not read these values yet. IBM will need key, project, regional URL and available model. The bridge will need a dedicated ingest token and the confirmed serial port. Database choice remains open.

## Team workflow

- Read `AGENTS.md`; use feature branches and small pull requests.
- Shared contracts: `lib/types.ts`; seed graph: `lib/demo.ts`; routes: `lib/routing.ts`; screens: `app/` and `components/`.
- Run `npm test` and `npm run build` before merging. GitHub Actions repeats both on pushes and pull requests.
- Suggested workstreams: interface/map; routing/data review; hardware/bridge; backend/persistence; IBM/demo coordination.
- Owner can invite teammates from repository Settings → Collaborators. Public visibility allows reading, not push access.

## Demo walkthrough

Select Automatic entrance → Classroom 201 with Avoid stairs. Inspect both floors and expand the text directions. Enable Prefer resting points and compare the longer Elevator B route with the direct Elevator A route. Enter a required width to see that unknown measurements cannot meet it. Clear the width, save an observation and reload to verify local persistence. Open Live conditions to see the single planned device and honest disconnected state.

The map is not to scale; elevator service is not verified. There is no indoor positioning or automatic recognition of users. Local reports are device-local and not submitted to campus staff. Access constraints are checked against fictional data and do not certify a real journey.
