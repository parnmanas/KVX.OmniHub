#include "Rs232Controller.h"

#include <HardwareSerial.h>

namespace {

// We always use UART2 on ESP32. The constructor argument `2` selects which
// peripheral; the actual pins are passed to begin() below.
HardwareSerial g_serial(2);
bool g_began = false;

// Last applied config. Reapplying with identical settings is a no-op, which
// is the common case when the same projector keeps getting commands at the
// same baud.
struct LineConfig {
  uint32_t baud = 0;
  uint32_t serialConfig = 0;
};
LineConfig g_currentConfig;

// Translate {dataBits, parity, stopBits} into the ESP32 HardwareSerial
// config constant. Returns 0 on invalid combination.
uint32_t buildSerialConfig(uint8_t dataBits, const char* parity,
                           uint8_t stopBits) {
  // The SERIAL_xPx constants encode: dataBits, parity (N/E/O), stopBits.
  // Most projectors use 8N1; we support 7/8 data, N/E/O parity, 1/2 stop.
  const bool d7 = dataBits == 7;
  const bool d8 = dataBits == 8;
  const bool pN = strcmp(parity, "none") == 0;
  const bool pE = strcmp(parity, "even") == 0;
  const bool pO = strcmp(parity, "odd") == 0;
  const bool s1 = stopBits == 1;
  const bool s2 = stopBits == 2;
  if (d8 && pN && s1) return SERIAL_8N1;
  if (d8 && pN && s2) return SERIAL_8N2;
  if (d8 && pE && s1) return SERIAL_8E1;
  if (d8 && pE && s2) return SERIAL_8E2;
  if (d8 && pO && s1) return SERIAL_8O1;
  if (d8 && pO && s2) return SERIAL_8O2;
  if (d7 && pN && s1) return SERIAL_7N1;
  if (d7 && pN && s2) return SERIAL_7N2;
  if (d7 && pE && s1) return SERIAL_7E1;
  if (d7 && pE && s2) return SERIAL_7E2;
  if (d7 && pO && s1) return SERIAL_7O1;
  if (d7 && pO && s2) return SERIAL_7O2;
  return 0;
}

}  // namespace

namespace Rs232Controller {

void begin() {
  // We don't start the UART here — wait until we know the baud the caller
  // wants. send() handles initial begin() and reconfig.
  g_began = false;
}

bool send(const JsonVariantConst& payload, String* responseOut) {
  uint32_t baud = payload["baud"] | 9600;
  uint8_t dataBits = payload["dataBits"] | 8;
  const char* parity = payload["parity"] | "none";
  uint8_t stopBits = payload["stopBits"] | 1;
  JsonArrayConst bytes = payload["bytes"].as<JsonArrayConst>();
  uint32_t responseTimeoutMs = payload["responseTimeoutMs"] | 0;

  // Range checks before we touch the UART. Bad params from a buggy preset
  // shouldn't be able to reconfigure the serial peripheral.
  if (baud < 1200 || baud > 921600) {
    Serial.printf("[rs232] reject: baud %u out of range\n", (unsigned)baud);
    return false;
  }
  if (!bytes || bytes.size() == 0) {
    Serial.println("[rs232] reject: no bytes in payload");
    return false;
  }
  if (bytes.size() > 1024) {
    Serial.printf("[rs232] reject: payload too long (%u bytes)\n",
                  (unsigned)bytes.size());
    return false;
  }
  uint32_t cfg = buildSerialConfig(dataBits, parity, stopBits);
  if (cfg == 0) {
    Serial.printf("[rs232] reject: bad line config %ud%s%u\n",
                  (unsigned)dataBits, parity, (unsigned)stopBits);
    return false;
  }

  // Pull bytes into a local buffer and sanity-check the range as we go —
  // ArduinoJson happily returns 0 for a missing element, but a misbehaving
  // preset could include e.g. 256 which would silently truncate.
  uint8_t buf[1024];
  size_t n = 0;
  for (JsonVariantConst v : bytes) {
    int b = v.as<int>();
    if (b < 0 || b > 255) {
      Serial.printf("[rs232] reject: byte %d out of range at index %u\n",
                    b, (unsigned)n);
      return false;
    }
    buf[n++] = static_cast<uint8_t>(b);
  }

  // Reconfigure the UART only if the line settings changed. Reapplying the
  // same config triggers a brief drop on TX which can confuse projectors
  // mid-conversation.
  if (!g_began || g_currentConfig.baud != baud ||
      g_currentConfig.serialConfig != cfg) {
    g_serial.end();
    g_serial.begin(baud, cfg, PIN_RS232_RX, PIN_RS232_TX);
    g_currentConfig = { baud, cfg };
    g_began = true;
    // Small settle delay so the line is idle before we transmit.
    delay(20);
  }

  Serial.printf("[rs232] send %u bytes @ %u %ud%s%u\n", (unsigned)n,
                (unsigned)baud, (unsigned)dataBits, parity,
                (unsigned)stopBits);
  size_t written = g_serial.write(buf, n);
  g_serial.flush();
  if (written != n) {
    Serial.printf("[rs232] write short: %u of %u bytes\n", (unsigned)written,
                  (unsigned)n);
    return false;
  }

  // Optional read-back. Most projectors echo a few ack bytes within a few
  // hundred ms; we collect up to 64 bytes and hand them back as hex pairs.
  if (responseOut && responseTimeoutMs > 0) {
    uint32_t deadline = millis() + responseTimeoutMs;
    responseOut->reserve(128);
    while (millis() < deadline && responseOut->length() < 64 * 2) {
      while (g_serial.available()) {
        uint8_t b = g_serial.read();
        char hex[3];
        snprintf(hex, sizeof(hex), "%02X", b);
        *responseOut += hex;
      }
      delay(2);
    }
  }
  return true;
}

}  // namespace Rs232Controller
