# Aiu2

Campus journey planning with personal preferences, route tradeoffs, community observations and local sensor conditions. The two-floor map is illustrative; access measurements remain unverified.

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
- A compact conditions panel and separate `/conditions` view poll the real API. Each device has an isolated ten-second window and classification state. Elevator B is provisioned as a second zone with no connected device or fabricated readings.
- A preference assistant interprets explicit travel requests, shows the matching words, and waits for the traveler to apply suggestions. IBM Granite is attempted server-side; a labeled local pattern fallback keeps the controls useful if IBM is unavailable. AI never chooses routes or invents map facts.
- The Elevator A node panel offers two editable profiles and an accessible node-code pairing button. One anonymous browser session can pair at a time for three minutes. The phone shows session-specific text directions and optional browser speech; sensor presence alone never identifies a traveler. A fresh hardware approach can queue a five-second controller command. The authenticated UNO Q bridge polls, forwards a short guidance code and returns a controller acknowledgement. No actuator is installed, and an acknowledgement never claims buzzing or vibration.

## Sensor configuration

Copy `.env.example` to `.env.local`. Set `AIU2_INGEST_TOKEN` to a randomly generated secret of at least 24 characters. Keep it on the server and laptop bridge, never in browser JavaScript. Ingestion returns 503 until configured and 401 for incorrect authentication.

- `AIU2_DB_PATH`: optional database filename; defaults to `data/aiu2.sqlite`.
- `AIU2_FOREGROUND_CM`: positive foreground threshold in centimetres, defaults to 30. Calibrate against the actual sensor geometry.
- `AIU2_SECURE_COOKIES=true`: use when hosting over HTTPS. Local HTTP development leaves this unset.
- `AIU2_API_URL`: used by the development reading sender; defaults to http://127.0.0.1:3003.

Set `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL`, and `WATSONX_MODEL_ID` in ignored `.env.local` for IBM inference. The configured region is `https://us-south.ml.cloud.ibm.com` and the selected model is `ibm/granite-4-h-small`. The key is never sent to the browser. The project must be associated with a watsonx.ai/WML service instance. An IAM smoke check succeeded on 2026-10-03, but a real chat request returned `403 no_associated_service_instance_error` for the supplied project, so IBM inference is **not yet connected**. No Tiger Data connection is used: its supplied URL has no password, and SQLite remains the working persistence layer. If later enabled, Tiger Data would centralize reports, preferences, and latest per-zone readings across multiple app servers or team devices; it is unnecessary for the current single-server flow.

The [current Hack Dearborn terms](https://www.hackdearborn.org/terms) describe general participation and prize rules, but the published site does not establish an IBM-specific track requirement. The team brief says the supplied rubric scores IBM technology. Confirm any IBM-specific scoring or sponsor eligibility with organizers before presenting that as an official rule.

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

The future second device uses `deviceId: "beacon-b"` and `zoneId: "elevator-b-lobby"`. The authenticated endpoint accepts either registered pair and rejects mismatched device/zone IDs. No second physical device has been connected or verified.

Use `simulation` or `replay` for generated or recorded events. Invalid echoes use `validDistance:false` and `distanceCm:null`; they are not evidence of empty space. Send raw readings around 5 Hz for the filter. Sequence is a nonnegative integer; bridge sessions must change after a restart. The server assigns UTC receipt time and ignores client timestamps. `(deviceId, bridgeSessionId, sequence)` deduplicates across restarts of the application; retries return the original event and do not refresh freshness or add samples. Accepted events are retained locally; sensor history analytics and retention tooling are not added.

- `GET /api/conditions`: Elevator A condition plus a `zones` array for A and B, with quality, median distance, occupied fraction and ten recent A samples. Fresh hardware takes priority per device; windows and state are isolated by device and source mode.
- `GET /api/nodes/pairing`: current browser pairing, phone guidance and latest controller-command status. `POST` pairs node code `A1` with one selected profile, destination and phone output choice; `DELETE` disconnects. Writes require a matching Origin. An occupied node returns 409 until its pairing expires or disconnects.
- `GET /api/nodes/command?deviceId=beacon-a` and `POST /api/nodes/command`: bridge-only command poll and acknowledgement, authenticated with the ingestion token. Commands are delivered idempotently, expire after five seconds and are rate-limited to one new command per node every 15 seconds. The board only stores a short guidance code and returns receipt or rejection; no actuator execution is claimed.
- `POST /api/preferences/interpret`: send `{ "text": "I want to avoid stairs and stop at a bench." }`. It returns reviewed suggestions plus a source label. IBM model output is schema-checked against allowed preference keys and exact input evidence; errors use a labeled local fallback. No unknown fields become preferences and nothing changes until the traveler applies suggestions.
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

Run `npm test` and `npm run build`. Focused tests cover routing, smoothing, invalid echoes, stale reads, retry deduplication, source isolation, pairing exclusivity, profile-specific guidance, command expiry and disconnects. A browser check covers the two profile flows. Unit tests do not prove controller receipt on a physical board.

The Arduino UNO Q (4 GB) and HC-SR04 previously delivered actual hardware events at roughly 5 Hz through USB ADB reverse forwarding. A roughly 10 cm object produced raw measurements near 10 cm without a software offset. The two-way sketch compiles for the UNO Q toolchain, but the board is currently disconnected, so a real controller acknowledgement and USB-disconnect round trip are not yet verified. See [hardware setup](hardware/README.md). IBM inference awaits a WML-associated project; moderation, account sync and production hosting remain future work. No elevator operation, continuous indoor location or safety certification is inferred from sensor activity.

Read `AGENTS.md` before contributing. Shared types live in `lib/types.ts`; storage in `lib/storage.ts`; signal processing in `lib/sensor-processing.ts`; routing in `lib/routing.ts`. GitHub Actions runs tests and build. Use small branches/PRs and prioritize an intuitive judge presentation.
