#include <Arduino_RouterBridge.h>

// UNO Q D10 = PB9, FT_f. No internal pull-up or pull-down.
constexpr int TRIGGER_PIN = D9;
constexpr int ECHO_PIN = D10;

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
}

void loop() {}
