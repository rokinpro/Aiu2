#include <Arduino_RouterBridge.h>

// UNO Q D10 = PB9, FT_f. No internal pull-up or pull-down.
constexpr int TRIGGER_PIN = D9;
constexpr int ECHO_PIN = D10;
String lastCommandId;
String lastGuidanceCode;
unsigned long lastCommandUntil = 0;

// Router Bridge delivers a parsed command from the Python side. This callback
// stores controller receipt only; there is no actuator connected or executed.
int receiveGuidance(String commandId, String code, int ttlMs) {
  if (commandId.length() != 36 || ttlMs <= 0 || ttlMs > 5000) return 0;
  if (code != "AT_DESTINATION" && code != "GO_TO_HALL" &&
      code != "USE_ELEVATOR_A" && code != "USE_ELEVATOR_B" &&
      code != "USE_STAIRS" && code != "CONTINUE") return 0;
  if (commandId == lastCommandId) return 2; // idempotent retry
  lastCommandId = commandId;
  lastGuidanceCode = code;
  lastCommandUntil = millis() + (unsigned long)ttlMs;
  return 1;
}

unsigned long readEchoMicroseconds() {
  digitalWrite(TRIGGER_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIGGER_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIGGER_PIN, LOW);
  // The factory UNO Q Zephyr core lacks pulseIn; use bounded GPIO timing.
  unsigned long waiting = micros();
  while (digitalRead(ECHO_PIN) == LOW) {
    if ((unsigned long)(micros() - waiting) >= 25000UL) return 0;
  }
  unsigned long rising = micros();
  while (digitalRead(ECHO_PIN) == HIGH) {
    if ((unsigned long)(micros() - rising) >= 25000UL) return 0;
  }
  return micros() - rising;
}

void setup() {
  pinMode(TRIGGER_PIN, OUTPUT);
  digitalWrite(TRIGGER_PIN, LOW);
  pinMode(ECHO_PIN, INPUT);
  Bridge.begin();
  // GPIO timing runs in the main loop context, not the RPC worker thread.
  Bridge.provide_safe("aiu2_read_echo", readEchoMicroseconds);
  Bridge.provide_safe("aiu2_receive_guidance", receiveGuidance);
}

void loop() {
  if (lastCommandId.length() && (long)(millis() - lastCommandUntil) >= 0) {
    lastCommandId = "";
    lastGuidanceCode = "";
  }
}
