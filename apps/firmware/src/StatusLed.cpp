#include "StatusLed.h"

#include "PinMap.h"

namespace {
StatusLed::State s_state = StatusLed::BOOT;
bool s_on = false;
uint32_t s_lastToggleMs = 0;

void write(bool on) {
  s_on = on;
  digitalWrite(PIN_STATUS_LED, on ? HIGH : LOW);
}
}  // namespace

namespace StatusLed {

void begin() {
  pinMode(PIN_STATUS_LED, OUTPUT);
  write(false);
  s_lastToggleMs = millis();
}

void set(State s) {
  if (s == s_state) return;
  s_state = s;
  s_lastToggleMs = millis();
  Serial.printf("[led] state -> %s\n", name(s));
  // Apply the steady portion of the new state immediately so the next tick()
  // doesn't lag by up to one full blink period.
  switch (s) {
    case BOOT:        write(false); break;
    case ONLINE:      write(true);  break;
    case WIFI_SETUP:
    case WIFI_READY:  write(true);  break;  // start the blink high
  }
}

State current() { return s_state; }

void tick() {
  uint32_t period = 0;
  switch (s_state) {
    case WIFI_SETUP: period = 500; break;  // 1 Hz
    case WIFI_READY: period = 100; break;  // 5 Hz
    case BOOT:
    case ONLINE:
    default:
      return;  // steady — nothing to do
  }
  uint32_t now = millis();
  if (now - s_lastToggleMs >= period) {
    s_lastToggleMs = now;
    write(!s_on);
  }
}

const char* name(State s) {
  switch (s) {
    case BOOT:       return "BOOT";
    case WIFI_SETUP: return "WIFI_SETUP";
    case WIFI_READY: return "WIFI_READY";
    case ONLINE:     return "ONLINE";
  }
  return "?";
}

}  // namespace StatusLed
