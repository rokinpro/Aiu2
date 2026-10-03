# Aiu2 hardware

## Identified from the team's photos

- Arduino UNO Q, 4 GB LPDDR4 / 32 GB eMMC variant. Box lists Qualcomm QRB2210 and STM32U585.
- HC-SR04 ultrasonic module with VCC, Trig, Echo and Gnd labels.
- One sensing zone: `beacon-a` at `elevator-a-lobby`.

The box and sensor labels are confirmed from photos; actual board discovery, firmware and physical readings have not been verified. Do not apply classic Uno R3 wiring/serial assumptions to UNO Q.

## Connection approach

Use Arduino App Lab with an Arduino sketch on the STM32 for timing and a Python process on the UNO Q's Linux side for authenticated HTTP ingestion. Arduino's Router Bridge connects those two processes. This avoids assuming that sketch console output appears as a conventional USB serial port on the laptop.

The Python forwarder must use the existing payload contract in the root README, send around five raw readings per second, and use `sourceMode: hardware` only for measurements obtained from the connected module. Invalid echoes remain null. Keep the ingestion token on the UNO Q, never in client code or Git. Two-way session commands are a later stage.

The board needs a reachable Aiu2 server URL. `127.0.0.1` on the UNO Q points to the board itself, not the developer's laptop. For a laptop-hosted application, use a mutually reachable network and the laptop's network address. Do not expose the existing localhost server without deliberately selecting the interface/network; no network-access configuration has been changed here.

## Electrical prerequisites

UNO Q's main GPIO headers operate at 3.3 V. Some MCU pins have conditional 5 V tolerance, but do not assume that across pins and modes. The pictured sensor is marked HC-SR04, not a confirmed low-voltage variant; treat it as the conventional 5 V module.

Use a suitable level shifter or a properly selected resistor divider on ECHO before the MCU input. Do not connect the sensor's 5 V echo directly while pin tolerance is unconfirmed. Supply and ground must follow the board/sensor pin labels, and all wiring must be performed with power disconnected. Final pin assignments and divider values will be selected after the team confirms available level-shifting parts. No motor or buzzer is needed for distance ingestion.

## Next physical steps

1. Connect the UNO Q with a USB-C data cable and discover it in Arduino App Lab. Use adequate power per Arduino's instructions.
2. Verify the built-in Blink example before attaching the sensor.
3. Confirm available level shifter or resistor values, then finalize the HC-SR04 wiring and sketch.
4. Connect App Lab's sketch/Python Bridge, configure the API URL and token privately, and observe actual distance readings.
5. Calibrate the fixed background and foreground threshold. Verify activity rise, object removal, invalid echoes and stale status after stopping the feed.

No standard USB serial device was visible on the development Mac at the latest check; Arduino CLI and ADB were not on PATH. This alone does not prove that the UNO Q is disconnected, since it has a different connection architecture.

## Official references

- [UNO Q user manual and Router Bridge](https://docs.arduino.cc/tutorials/uno-q/user-manual/)
- [UNO Q datasheet and GPIO voltage guidance](https://docs.arduino.cc/resources/datasheets/ABX00162-datasheet.pdf)
- [HC-SR04 datasheet from ElecFreaks, hosted by SparkFun](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf)
