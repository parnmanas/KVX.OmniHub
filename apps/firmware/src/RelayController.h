#pragma once

#include <Arduino.h>

// Multi-channel relay driver. Channels are 0-indexed. Pin mapping and active
// polarity come from PinMap.h.
//
// Momentary (pulse) mode: set(channel, ON, durationMs) returns immediately
// and the channel auto-clears to OFF after durationMs (non-blocking — runs
// off the loop via tick()).
namespace RelayController {

enum State : uint8_t {
  OFF = 0,
  ON = 1,
  TOGGLE = 2,
};

// Wire up pin modes and force every channel OFF. Call once from setup().
void begin();

// Apply a state change. If durationMs > 0 and resolved state is ON, the
// channel auto-reverts to OFF after that many ms. Returns false for invalid
// channel.
bool set(uint8_t channel, State state, uint32_t durationMs = 0);

// Drive auto-OFF timers. Call every loop iteration.
void tick();

// Current logical state of a channel (post-resolve, ignoring auto-OFF).
bool isOn(uint8_t channel);

// Number of configured channels (= PIN_RELAY_COUNT).
uint8_t channelCount();

}  // namespace RelayController
