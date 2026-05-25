#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "PinMap.h"

// RS232 serial output for projectors / AV gear.
//
// Wire format: standard 8N1 / 7E1 / etc. configurable per send. The server
// passes the full byte sequence; the firmware just reconfigures the UART
// and writes the bytes verbatim. This mirrors the IR approach (server
// encodes, firmware transmits raw) so new projector models = pure preset
// additions, no reflash.
//
// Hardware: ESP32 Serial2 on PIN_RS232_RX / PIN_RS232_TX. A MAX3232 (or
// equivalent) transceiver is required between the ESP32 and the projector
// to convert TTL ↔ ±12V RS232 levels — see PinMap.h.
namespace Rs232Controller {

void begin();

// Drive a single command. `payload` must be the JSON object with keys
// {baud, dataBits, parity, stopBits, bytes}. Returns true if the bytes
// were written; false on bad params (e.g. baud out of range, empty
// bytes, bytes element out of 0..255).
//
// If `responseTimeoutMs` is present and > 0, reads back any bytes the
// projector echoes / acks and fills `responseOut` (hex pairs). Pass
// nullptr to ignore the response.
bool send(const JsonVariantConst& payload, String* responseOut = nullptr);

}  // namespace Rs232Controller
