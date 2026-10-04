# Run Aiu2 on another computer

The app runs locally on macOS, Windows, or Linux with Node.js 22.13 or newer, npm, and Git. Install Node.js from the [official downloads page](https://nodejs.org/en/download). The map, route planner, preferences, reports, and manual controls work without an Arduino or cloud credentials. The physical readings and buzzer require the team's UNO Q.

## 1. Start the app

In Terminal or PowerShell:

```sh
git clone https://github.com/rokinpro/Aiu2.git
cd Aiu2
node --version
npm ci
npm run dev -- --port 3003
```

Open <http://localhost:3003>. Leave that terminal running. On the first API request, SQLite creates `data/aiu2.sqlite`; this ignored folder contains the local preferences, reports, pairings, and recent sensor readings. Each browser gets its own anonymous session. The public GitHub repository contains the code, not this local data or any credentials.

For a production-mode check on the same computer, stop the development server, then run `npm run build` and `npm run start -- --port 3003`. Run `npm test` to check the routing, sensor processing, storage, and pairing logic.

If judges need to open the app from a phone on the same network, start it with `npm run dev -- --hostname 0.0.0.0 --port 3003` and open `http://<computer-LAN-IP>:3003` on the phone. Allow the port through the computer's firewall if prompted. A second computer has its own SQLite data unless both use a separately hosted persistent application server.

## 2. Enable optional services

Create an ignored private environment file. On macOS/Linux, run `cp .env.example .env.local`; in Windows PowerShell, run `Copy-Item .env.example .env.local`. Fill in only the services the team intends to use, then restart the app. Never commit `.env.local` or paste keys into the website.

| Variable | Used for |
| --- | --- |
| `AIU2_INGEST_TOKEN` | Authenticates UNO Q readings and guidance-command polling; use the same token in the board config. It must be at least 24 characters. |
| `DATABASE_URL` | Optional Tiger Cloud archive of accepted readings by device and source. Live routing, pairing, preferences, and reports still use SQLite. |
| `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL`, `WATSONX_MODEL_ID` | Optional IBM Granite preference suggestions; local fallback remains available. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` | Optional server-side spoken directions; browser speech is labeled as a fallback. |
| `GEMINI_API_KEY`, `GEMINI_MODEL_ID` | Optional contributor-photo draft assistance. |
| `AIU2_DB_PATH` | Optional alternate SQLite filename. |

Generate a fresh ingestion token, if needed, with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Share private values with teammates through a private channel, not the repository. The original laptop's ignored `.env.local` and the UNO Q's ignored `device-config.json` are not included by `git clone`.

## 3. Connect the physical UNO Q

Install [Arduino App Lab](https://docs.arduino.cc/tutorials/uno-q/user-manual/) on the computer and connect the UNO Q with a USB-C **data** cable. Follow the [pin table and electrical notes](hardware/README.md) before powering the circuit. The confirmed wiring is HC-SR04 TRIG to D9 and ECHO to D10, Grove Buzzer SIG to D8, both modules to the board's 5 V and GND pins.

The implemented board app is in `hardware/uno-q/`. Copy `hardware/uno-q/python/device-config.example.json` to `hardware/uno-q/python/device-config.json`. Set `ingest_token` to the exact `AIU2_INGEST_TOKEN` from `.env.local`; keep `api_url` as `http://msgpack-rpc-router:3003` for the verified USB reverse-forwarding setup. This private config is ignored by Git.

With ADB available from App Lab or on your PATH, the verified deployment sequence is:

```sh
adb devices
adb reverse tcp:3003 tcp:3003
adb push hardware/uno-q/. /home/arduino/ArduinoApps/aiu2-beacon/
adb shell 'chmod 600 /home/arduino/ArduinoApps/aiu2-beacon/python/device-config.json'
adb shell 'TMPDIR=/tmp arduino-app-cli app start /home/arduino/ArduinoApps/aiu2-beacon'
```

On Windows, use `adb.exe` or its installed full path if `adb` is not on PATH. On Linux, follow Arduino's [UNO Q USB permission instructions](https://docs.arduino.cc/tutorials/uno-q/user-manual/) if `adb devices` cannot access the board. App Lab can also compile/start the board app; the commands above match the team's tested USB setup. Re-run `adb reverse tcp:3003 tcp:3003` after a USB reconnect. The board and the app must use the same port and token.

Open <http://localhost:3003/conditions>. A connected Elevator A sensor should show a recent **Hardware** distance; missing or interrupted readings become unknown after five seconds. On the home page, connect Profile A to Elevator A Beacon, hold an object around 10 cm from the sensor, and expect one brief two-pulse cue plus phone directions. The cue runs once per pairing; reconnect after the rate limit to repeat. Elevator B is prepared as a second zone, but the team has not connected a second physical sensor.

## 4. Know the current limits

- The two-floor map is illustrative. Widths and slopes remain unknown, and no sensor proves an elevator is operating or a route is safe.
- Sensor activity is a presence proxy, not a people count. The user chooses whether to switch routes.
- Reports await review; they do not modify the map automatically.
- SQLite is local to one persistent Node server. Do not expect durable data from an ephemeral serverless deployment or automatic sync between teammates' laptops.
- The USB-connected UNO Q cannot feed a remote cloud server directly without the board-side bridge and a reachable API URL. The verified bridge stays with the connected computer.
