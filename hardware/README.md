# Aiu2 hardware

## Identified from the team's photos

- Arduino UNO Q, 4 GB LPDDR4 / 32 GB eMMC variant. Box lists Qualcomm QRB2210 and STM32U585.
- HC-SR04 ultrasonic module with VCC, Trig, Echo and Gnd labels.
- One sensing zone: `beacon-a` at `elevator-a-lobby`.

The box and sensor labels are confirmed from photos; board discovery, compiled firmware, and hardware event ingestion are now verified. Valid sensor echoes are still pending. Do not apply classic Uno R3 wiring/serial assumptions to UNO Q.

## Connection approach

Use Arduino App Lab with an Arduino sketch on the STM32 for timing and a Python process on the UNO Q's Linux side for authenticated HTTP ingestion. Arduino's Router Bridge connects those two processes. This avoids assuming that sketch console output appears as a conventional USB serial port on the laptop.

The Python forwarder must use the existing payload contract in the root README, send around five raw readings per second, and use `sourceMode: hardware` only for measurements obtained from the connected module. Invalid echoes remain null. Keep the ingestion token on the UNO Q, never in client code or Git. Two-way session commands are a later stage.

The board needs a reachable Aiu2 server URL. `127.0.0.1` on the UNO Q points to the board itself, not the developer's laptop. For a laptop-hosted application, use a mutually reachable network and the laptop's network address. Do not expose the existing localhost server without deliberately selecting the interface/network; no network-access configuration has been changed here.

## Electrical prerequisites

UNO Q's main GPIO headers operate at 3.3 V. Some MCU pins have conditional 5 V tolerance, but do not assume that across pins and modes. The pictured sensor is marked HC-SR04, not a confirmed low-voltage variant; treat it as the conventional 5 V module.

For the selected pin D10, a divider is not required: Arduino maps D10 to STM32 PB9, and ST lists PB9 as FT_f (5 V-tolerant). Configure it as plain digital INPUT, with internal pull-up/pull-down disabled. This pin-specific finding supersedes the earlier conservative requirement for a level shifter.

| HC-SR04 | UNO Q |
| --- | --- |
| VCC | +5V OUT |
| GND | GND |
| TRIG | D9 (output) |
| ECHO | D10 / PB9 (plain digital input) |

Disconnect power before wiring. Power the sensor from the board, not an independent always-on supply: do not drive ECHO into an unpowered MCU. Do not substitute analog, JCTL or other pins based on a blanket claim of tolerance. The 3.3 V trigger is intended for the module's TTL trigger input; verify actual readings with this module. The deployed sketch currently reports invalid echoes; valid distance measurements are not yet verified.

Pin-specific sources: [Arduino pin mapping](https://docs.arduino.cc/resources/pinouts/ABX00162-full-pinout.pdf) and [STM32U585 datasheet](https://www.st.com/resource/en/datasheet/stm32u585ai.pdf), PB9 FT_f row and input-voltage conditions (internal pulls disabled).

## Next physical steps

1. Connect the UNO Q with a USB-C data cable and discover it in Arduino App Lab. Use adequate power per Arduino's instructions.
2. Verify the built-in Blink example before attaching the sensor.
3. Wire the HC-SR04 using the pin-specific table above and a sketch configuring D10 as INPUT with no pulls.
4. Connect App Lab's sketch/Python Bridge, configure the API URL and token privately, and observe actual distance readings.
5. Calibrate the fixed background and foreground threshold. Verify activity rise, object removal, invalid echoes and stale status after stopping the feed.

The UNO Q is detected via USB ADB. It does not need to appear as a conventional serial port.

## Official references

- [UNO Q user manual and Router Bridge](https://docs.arduino.cc/tutorials/uno-q/user-manual/)
- [UNO Q datasheet and GPIO voltage guidance](https://docs.arduino.cc/resources/datasheets/ABX00162-datasheet.pdf)
- [HC-SR04 datasheet from ElecFreaks, hosted by SparkFun](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf)

## Implemented UNO Q application

`uno-q/` contains an App Lab application. The sketch exposes `aiu2_read_echo` via Router Bridge's main-loop callback, using D9 trigger and D10 INPUT, a 10 microsecond pulse and bounded 25 ms wait/high phases. Python samples at roughly 5 Hz, rejects out-of-range echoes, and forwards authenticated hardware events with a unique bridge session and sequence. A bounded queue drops old readings rather than delivering a stale backlog as fresh conditions. Failed RPC calls produce no invented readings.

Copy `python/device-config.example.json` to `python/device-config.json` and privately set the ingestion token from the app's `.env.local`. The real config is gitignored. Keep its permissions at 600. Do not copy credentials into the sketch or public source.

The confirmed USB workflow uses ADB reverse forwarding, so the board can reach the Mac's loopback-only server without campus Wi-Fi:

```sh
# With adb on PATH and Aiu2 running locally on port 3003:
adb reverse tcp:3003 tcp:3003
adb push hardware/uno-q/. /home/arduino/ArduinoApps/aiu2-beacon/
adb shell 'chmod 600 /home/arduino/ArduinoApps/aiu2-beacon/python/device-config.json'
adb shell 'TMPDIR=/tmp arduino-app-cli app start /home/arduino/ArduinoApps/aiu2-beacon'
```

Repeat reverse forwarding after USB reconnection. The factory board's ADB session sets TMPDIR to a nonexistent `/data/local/tmp`; overriding it to `/tmp` avoids that error without changing privileged system directories. The factory App CLI is 0.6.6 with Zephyr core 0.51.0. Dependencies are listed in `sketch/sketch.yaml`; initial compilation may need downloads. When the board has no network, library ZIPs can be downloaded from Arduino on the Mac and copied into the board's `.arduino15/staging/libraries` cache.

Local App Lab bundle discovery found ADB under `arduino_applab_workspace/arduino15/data/packages/arduino/tools/adb/32.0.0/adb`. This machine-specific path is not required on teammates' machines; locate their installed ADB or use their App Lab setup.

## Latest physical verification

The sketch compiled and flashed on the actual UNO Q with its installed Zephyr 0.51.0 core. That core does not link `pulseIn`, so the sketch uses bounded `micros`/`digitalRead` timing instead. App Lab started the Python container successfully. Hardware events arrive through authenticated ingestion at approximately five per second and are persisted in SQLite. All current echoes are invalid, producing null distance, 0% valid quality and unknown activity. Valid distance and a physical object-driven route change still need confirmation.

Inside the App Lab container, use `http://msgpack-rpc-router:3003` for the reverse-forwarded API. App Lab supplies that hostname as the board host gateway; container loopback does not reach the host's ADB listener. The application remains bound to Mac loopback. The board-side ADB reverse listener may bind all board interfaces, so retain ingestion authentication and remove forwarding with `adb reverse --remove tcp:3003` when finished.
