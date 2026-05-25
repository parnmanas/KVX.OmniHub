#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "PinMap.h"

// Wraps IRremoteESP8266 for the two operations the protocol exposes:
//   1) Send an IR command described by an IrPayload (decoded value or raw).
//   2) Learn an IR command — blocks for `timeoutMs` and returns the captured
//      protocol/decoded/raw triple.
//
// Decoded values are exchanged as hex strings (no "0x" prefix) so they fit
// the shared `{ value: string, bits: number }` schema.
namespace IrController {

void begin();

// `khz` is the carrier frequency for raw transmission (server encoded).
// Defaults to 38 for backward compatibility with old captures.
bool send(const JsonVariantConst& payload, uint16_t khz = 38);

// Fills `out` with the captured IR data. `out` must be a JsonObject ready
// to populate. Returns true on capture, false on timeout.
bool learn(uint32_t timeoutMs, JsonObject out);

}  // namespace IrController
