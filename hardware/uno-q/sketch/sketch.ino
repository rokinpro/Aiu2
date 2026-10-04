#include <Arduino_RouterBridge.h>

// UNO Q D10 = PB9, FT_f. No internal pull-up or pull-down.
constexpr int TRIGGER_PIN = D9;
constexpr int ECHO_PIN = D10;
constexpr int BUZZER_PIN = D8;
String lastCommandId;
String lastGuidanceCode;
unsigned long lastCommandUntil = 0;
unsigned long cueNextAt = 0;
int cueStep = 0;
bool cueCompleted = false;

// Router Bridge delivers a parsed command from the Python side. This callback
// schedules a short attention cue. Detailed directions remain on the phone.
int receiveGuidance(String commandId, String code, int ttlMs) {
  if (commandId.length() != 36 || ttlMs <= 0 || ttlMs > 5000) return 0;
  if (code != "AT_DESTINATION" && code != "GO_TO_HALL" &&
      code != "USE_ELEVATOR_A" && code != "USE_ELEVATOR_B" &&
      code != "USE_STAIRS" && code != "CONTINUE") return 0;
  if (commandId == lastCommandId) return 2; // idempotent retry
  lastCommandId = commandId;
  lastGuidanceCode = code;
  lastCommandUntil = millis() + (unsigned long)ttlMs;
  cueCompleted = false;
  cueStep = 1;
  cueNextAt = millis() + 80UL;
  digitalWrite(BUZZER_PIN, HIGH);
  return 1;
}

// 0 = unknown/expired, 1 = accepted but cue pending, 2 = cue completed.
int guidanceStatus(String commandId) {
  if (commandId != lastCommandId || (long)(millis() - lastCommandUntil) >= 0) return 0;
  return cueCompleted ? 2 : 1;
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
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  Bridge.begin();
  // GPIO timing runs in the main loop context, not the RPC worker thread.
  Bridge.provide_safe("aiu2_read_echo", readEchoMicroseconds);
  Bridge.provide_safe("aiu2_receive_guidance", receiveGuidance);
  Bridge.provide_safe("aiu2_guidance_status", guidanceStatus);
}

void loop() {
  if (lastCommandId.length() && (long)(millis() - lastCommandUntil) >= 0) {
    digitalWrite(BUZZER_PIN, LOW);
    lastCommandId = "";
    lastGuidanceCode = "";
    cueStep = 0;
    cueCompleted = false;
  }
  if (cueStep && (long)(millis() - cueNextAt) >= 0) {
    if (cueStep == 1) {
      digitalWrite(BUZZER_PIN, LOW);
      cueStep = 2;
      cueNextAt = millis() + 250UL;
    } else if (cueStep == 2) {
      digitalWrite(BUZZER_PIN, HIGH);
      cueStep = 3;
      cueNextAt = millis() + 80UL;
    } else {
      digitalWrite(BUZZER_PIN, LOW);
      cueStep = 0;
      cueCompleted = true;
    }
  }
}
