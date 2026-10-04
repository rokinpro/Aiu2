# Aiu2 hardware

## Identified from the team's photos

- Arduino UNO Q, 4 GB LPDDR4 / 32 GB eMMC variant. Box lists Qualcomm QRB2210 and STM32U585.
- HC-SR04 ultrasonic module with VCC, Trig, Echo and Gnd labels.
- Seeed Grove Buzzer v1.2 (photo of module back); the team confirmed SIG on D8 and VCC on 5V.
- One sensing zone: `beacon-a` at `elevator-a-lobby`.

The box and sensor labels are confirmed from photos; board discovery, compiled firmware, hardware event ingestion and raw readings near a 10 cm test object were previously verified. Do not apply classic Uno R3 wiring/serial assumptions to UNO Q.

## Connection approach

Use Arduino App Lab with an Arduino sketch on the STM32 for timing and a Python process on the UNO Q's Linux side for authenticated HTTP ingestion. Arduino's Router Bridge connects those two processes. This avoids assuming that sketch console output appears as a conventional USB serial port on the laptop.

The Python forwarder uses the existing payload contract in the root README, sends around five raw readings per second, and uses `sourceMode: hardware` only for measurements obtained from the connected module. Invalid echoes remain null. Keep the ingestion token on the UNO Q, never in client code or Git. For two-way guidance, the same Python process polls short-lived commands over USB reverse forwarding and passes only a command ID, guidance code and remaining TTL to the MCU through Router Bridge. The MCU runs a brief two-pulse buzzer cue and reports completion separately from receiving a command.

The board needs a reachable Aiu2 server URL. The verified USB setup uses ADB reverse forwarding and `http://msgpack-rpc-router:3003` in the Python container. `127.0.0.1` inside the container would point to the container itself.

## Electrical prerequisites

UNO Q's main GPIO headers operate at 3.3 V. Some MCU pins have conditional 5 V tolerance, but do not assume that across pins and modes. The pictured sensor is marked HC-SR04, not a confirmed low-voltage variant; treat it as the conventional 5 V module.

For the selected pin D10, a divider is not required: Arduino maps D10 to STM32 PB9, and ST lists PB9 as FT_f (5 V-tolerant). Configure it as plain digital INPUT, with internal pull-up/pull-down disabled. This pin-specific finding supersedes the earlier conservative requirement for a level shifter.

| HC-SR04 | UNO Q |
| --- | --- |
| VCC | +5V OUT |
| GND | GND |
| TRIG | D9 (output) |
| ECHO | D10 / PB9 (plain digital input) |

| Grove Buzzer v1.2 | UNO Q |
| --- | --- |
| GND / black | GND |
| VCC / red | +5V OUT |
| SIG / yellow | D8 (digital output) |
| NC / white | Not used |

The Grove Buzzer accepts 3.3 V or 5 V supply and is controlled by a digital signal. D8 drives its module input; it does not directly power the buzzer. The team confirmed this wiring and heard the brief cue after the pin correction. See [Seeed's Grove Buzzer documentation](https://wiki.seeedstudio.com/Grove-Buzzer/).

Disconnect power before wiring. Power the sensor from the board, not an independent always-on supply: do not drive ECHO into an unpowered MCU. Do not substitute analog, JCTL or other pins based on a blanket claim of tolerance. The 3.3 V trigger is intended for the module's TTL trigger input. Raw readings near 10 cm were observed with a 10 cm test object; no software offset is applied.

Pin-specific sources: [Arduino pin mapping](https://docs.arduino.cc/resources/pinouts/ABX00162-full-pinout.pdf) and [STM32U585 datasheet](https://www.st.com/resource/en/datasheet/stm32u585ai.pdf), PB9 FT_f row and input-voltage conditions (internal pulls disabled).

## Physical setup and check

1. Connect the UNO Q with a USB-C data cable and wire the HC-SR04 using the pin table above.
2. Configure the API URL and token privately, establish ADB reverse forwarding, and start the App Lab app using the commands below.
3. Observe raw distance and activity in Conditions. Keep raw distance unchanged; adjust only the foreground threshold for the installed sensor geometry.
4. Print [the `A1` code label](uno-q/node-label.svg). Pair Profile A, approach the sensor, and check the short buzzer cue and phone guidance. The UI says “Buzzer cue completed” only after the controller confirms it finished the pulses. Repeat with Profile B, then disconnect the pairing.

The UNO Q is detected via USB ADB. It does not need to appear as a conventional serial port.

## Official references

- [UNO Q user manual and Router Bridge](https://docs.arduino.cc/tutorials/uno-q/user-manual/)
- [UNO Q datasheet and GPIO voltage guidance](https://docs.arduino.cc/resources/datasheets/ABX00162-datasheet.pdf)
- [HC-SR04 datasheet from ElecFreaks, hosted by SparkFun](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf)

## Implemented UNO Q application

`uno-q/` contains an App Lab application. The sketch exposes `aiu2_read_echo` via Router Bridge's main-loop callback, using D9 trigger and D10 INPUT, a 10 microsecond pulse and bounded 25 ms wait/high phases. Python samples at roughly 5 Hz, rejects out-of-range echoes, and forwards authenticated hardware events with a unique bridge session and sequence. A bounded queue drops old readings rather than delivering a stale backlog as fresh conditions. Failed RPC calls produce no invented readings.

The sketch also exposes `aiu2_receive_guidance` and `aiu2_guidance_status` through main-loop callbacks. It checks the short command ID/code/TTL, remembers the last ID to deduplicate retries, and drives D8 with two 80 ms pulses separated by 250 ms without blocking the sensing loop. The Python process posts `actuatorExecuted: true` only after `aiu2_guidance_status` reports completion. Continued presence does not retrigger a cue within the same pairing. The cue means new guidance is available; all route details remain on the phone. The board uses App Lab Router Bridge rather than conventional laptop serial JSON input.

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

On 2026-10-03 the two-way sketch compiled and flashed on the actual UNO Q, and App Lab started the Python bridge. Hardware events reached SQLite at approximately five per second. An object near the HC-SR04 caused activity and queued personalized commands: Profile A to Classroom 201 produced `USE_ELEVATOR_A`; Profile B to the bench produced `GO_TO_HALL`. The MCU acknowledged both commands through Router Bridge. The board clock was behind the laptop, so command polling now passes a server-relative TTL and the Python bridge checks it with a monotonic clock. Removing ADB reverse forwarding made status stale/unknown; restoring it resumed fresh readings.

Later on 2026-10-03, the team's Grove Buzzer v1.2 was connected with SIG on D8, VCC on 5V and GND on GND. The first sketch targeted D6 because of an incorrect pin report, leaving the actual D8 input floating and causing a continuous buzz. After correcting D8, the board became quiet between commands. A paired physical approach produced `USE_ELEVATOR_A`, the controller reported the two-pulse cue completed, and the team heard one brief cue. Repeated commands from continued presence were removed by limiting cues to one per pairing. A second physical sensor and physical USB unplug remain untested.

Inside the App Lab container, use `http://msgpack-rpc-router:3003` for the reverse-forwarded API. App Lab supplies that hostname as the board host gateway; container loopback does not reach the host's ADB listener. The application remains bound to Mac loopback. The board-side ADB reverse listener may bind all board interfaces, so retain ingestion authentication and remove forwarding with `adb reverse --remove tcp:3003` when finished.
