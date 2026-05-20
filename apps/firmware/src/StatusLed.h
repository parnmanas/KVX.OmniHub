#pragma once

#include <Arduino.h>

// Status LED state machine. Drives PIN_STATUS_LED with a different visual
// pattern per high-level device state so the operator can diagnose at a
// glance without a serial console.
//
// Patterns:
//   BOOT        — off (pre-init)
//   WIFI_SETUP  — slow blink, 1 Hz   (portal open or trying saved creds)
//   WIFI_READY  — fast blink, 5 Hz   (Wi-Fi up, server not yet reachable)
//   ONLINE      — solid on           (WebSocket authenticated with server)
namespace StatusLed {

enum State : uint8_t {
  BOOT = 0,
  WIFI_SETUP,
  WIFI_READY,
  ONLINE,
};

// Configure the LED pin. Safe to call once from setup() early.
void begin();

// Switch to a new state. No-op if `s` equals the current state, so it is
// cheap to call every loop iteration.
void set(State s);

// Current state.
State current();

// Drive the LED according to the current state. Call from loop().
void tick();

// Human-readable label for logging.
const char* name(State s);

}  // namespace StatusLed
