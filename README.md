# Aiu2

Campus journey planning with personal preferences, route tradeoffs, community observations and local sensor conditions. Prompts 1–3 implemented. The two-floor map is illustrative; access measurements remain unverified.

## Run

Use Node.js 22.13+ (built-in `node:sqlite`) and npm. No hosted database account is needed.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Production: `npm run build` then `npm start`. SQLite automatically creates `data/aiu2.sqlite` on the first API request. Keep this directory on persistent disk. This adapter is for one Node server, not an ephemeral or multi-instance serverless deployment.

## Features

- 12 map locations and 25 directed paths across two floors, with text directions and keyboard controls.
- Dijkstra routing with hard stairs, closure and known-width constraints. Configurable nonnegative soft weights for travel, walking, activity, lighting, surfaces and rest opportunities; identical options collapse.
- The selected journey remains unchanged when conditions change. A new route offer explains its distance/time tradeoff; the traveler accepts or declines it.
- Reports and preferences persist in SQLite. An anonymous HttpOnly session cookie scopes them to the browser; no medical identity or account is required. Reports remain pending and never change route access automatically. The interface shows the latest 50 reports belonging to that session. Clearing the cookie loses access to that session's records; this is not cross-device account sync or a moderation portal.
- Authenticated sensor ingestion, durable deduplication, recent readings and source attribution.
- A compact conditions panel and separate `/conditions` view poll the real API. Source mode is retained and shown there. There are no fabricated readings when the sensor is absent.

## Sensor configuration

Copy `.env.example` to `.env.local`. Set `AIU2_INGEST_TOKEN` to a randomly generated secret of at least 24 characters. Keep it on the server and laptop bridge, never in browser JavaScript. Ingestion returns 503 until configured and 401 for incorrect authentication.

- `AIU2_DB_PATH`: optional database filename; defaults to `data/aiu2.sqlite`.
- `AIU2_FOREGROUND_CM`: positive foreground threshold in centimetres, defaults to 30. Calibrate against the actual sensor geometry.
- `AIU2_SECURE_COOKIES=true`: use when hosting over HTTPS. Local HTTP development leaves this unset.
- `AIU2_API_URL`: used by the development reading sender; defaults to http://127.0.0.1:3003.

IBM and serial placeholders are reserved for later stages. No Tiger Data connection or other external service is used. Tiger Data would be appropriate later for centrally hosted reports/preferences and sensor history when multiple app instances or team devices need the same database.

## API contract

`POST /api/sensors/ingest` requires `Authorization: Bearer <AIU2_INGEST_TOKEN>` and JSON:

```json
{
  "deviceId": "beacon-a",
  "zoneId": "elevator-a-lobby",
  "bridgeSessionId": "unique-per-bridge-start",
  "sequence": 42,
  "sourceMode": "hardware",
  "distanceCm": 18.4,
  "validDistance": true
}
```

Use `simulation` or `replay` for generated or recorded events. Invalid echoes use `validDistance:false` and `distanceCm:null`; they are not evidence of empty space. Send raw readings around 5 Hz for the filter. Sequence is a nonnegative integer; bridge sessions must change after a restart. The server assigns UTC receipt time and ignores client timestamps. `(deviceId, bridgeSessionId, sequence)` deduplicates across restarts of the application; retries return the original event and do not refresh freshness or add samples. Accepted events are retained locally; sensor history analytics and retention tooling are not added.

- `GET /api/conditions`: latest condition, quality, median distance, occupied fraction and ten recent samples. Fresh hardware takes priority; windows are isolated by source mode.
- `GET /api/preferences`, `PUT /api/preferences`: session-scoped profile. PUT needs an Origin matching the app URL.
- `GET /api/reports`, `POST /api/reports`: session-scoped pending observations. POST validates location/type/text and assigns source, ID, timestamp and pending status on the server. Origin must match; a session can submit at most ten reports per minute.
- `GET /api/health`: SQLite readiness and whether ingestion authentication is configured; no secrets.

## Signal interpretation

The last ten seconds of readings form an occupied-fraction window. A three-valid-sample sliding median removes isolated echoes before thresholding. The panel also exposes a median of the latest five valid distances. Clear is below 20% occupied, some activity is 20–60%, and sustained is above 60%. These are tunable prototype heuristics, not a people count or validated crowd estimate.

At least three valid samples, at least 60% valid quality and a valid echo within five seconds are required. Otherwise activity becomes unknown immediately. A state change requires three consecutive classifications, at most once per second. A gap over five seconds resets smoothing; stale reads return unknown even if no new event arrives. Invalid echoes lower quality rather than counting as clear. Source modes never share a classification window.

## Repeatable development demonstration

Generate readings through the same authenticated endpoint and processing path used by a future bridge:

```sh
# Match the running server URL in AIU2_API_URL if not using port 3003.
node --env-file=.env.local scripts/send-readings.mjs 20 15
# Then show object removal:
node --env-file=.env.local scripts/send-readings.mjs 60 15
```

The sender always labels data `simulation`. Select Avoid stairs and Prefer quieter areas for the Automatic entrance → Classroom 201 journey. Once sustained activity is confirmed, Elevator B is offered with 24 additional metres and 31 additional seconds. Accept to switch directions. Stop the sender and observe unknown activity after five seconds. Clearing a full busy window takes approximately ten seconds plus confirmation; do not expect an instantaneous return to clear.

## Verification and limitations

Run `npm test` and `npm run build`. Focused tests cover routing, smoothing, invalid echoes, stale reads, retry deduplication, source isolation and reopening SQLite to prove persistence. A real HTTP smoke check covers authorization, ingestion, report/profile persistence and stale status using generated input. This does not prove physical hardware operation.

The Arduino UNO Q (4 GB) is connected and the HC-SR04 sketch has compiled and flashed. App Lab's Python forwarder delivers actual hardware events at roughly 5 Hz through USB ADB reverse forwarding. Current echoes are invalid (null distance), so physical distance measurement and object-driven route changes remain pending. See [hardware setup](hardware/README.md). AI, two-way commands, moderation, account sync and production hosting remain future work. No elevator operation, continuous indoor location or safety certification is inferred from sensor activity.

Read `AGENTS.md` before contributing. Shared types live in `lib/types.ts`; storage in `lib/storage.ts`; signal processing in `lib/sensor-processing.ts`; routing in `lib/routing.ts`. GitHub Actions runs tests and build. Use small branches/PRs and prioritize an intuitive judge presentation.
