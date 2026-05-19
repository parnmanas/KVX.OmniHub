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

bool send(const JsonVariantConst& payload);

bool learn(uint32_t timeoutMs, JsonObject out);

}  // namespace IrController
