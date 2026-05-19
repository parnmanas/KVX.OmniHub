#include "IrController.h"

#include <IRrecv.h>
#include <IRsend.h>
#include <IRutils.h>

namespace {
constexpr uint16_t RX_BUFFER_SIZE = 1024;
constexpr uint8_t RX_TIMEOUT_MS = 50;     // gap between IR bursts
constexpr uint16_t MIN_UNKNOWN_SIZE = 12;

IRrecv* g_recv = nullptr;
IRsend* g_send = nullptr;

decode_type_t protoFromString(const char* s) {
  if (!s) return UNKNOWN;
  if (strcmp(s, "NEC") == 0) return NEC;
  if (strcmp(s, "SONY") == 0) return SONY;
  if (strcmp(s, "RC5") == 0) return RC5;
  if (strcmp(s, "RC6") == 0) return RC6;
  if (strcmp(s, "SAMSUNG") == 0) return SAMSUNG;
  if (strcmp(s, "LG") == 0) return LG;
  return UNKNOWN;
}

const char* protoToString(decode_type_t t) {
  switch (t) {
    case NEC: return "NEC";
    case SONY: return "SONY";
    case RC5: return "RC5";
    case RC6: return "RC6";
    case SAMSUNG: return "SAMSUNG";
    case LG: return "LG";
    default: return "UNKNOWN";
  }
}

uint64_t parseHex(const char* s) {
  if (!s) return 0;
  if (s[0] == '0' && (s[1] == 'x' || s[1] == 'X')) s += 2;
  uint64_t v = 0;
  while (*s) {
    char c = *s++;
    uint8_t d;
    if (c >= '0' && c <= '9') d = c - '0';
    else if (c >= 'a' && c <= 'f') d = 10 + c - 'a';
    else if (c >= 'A' && c <= 'F') d = 10 + c - 'A';
    else break;
    v = (v << 4) | d;
  }
  return v;
}
}  // namespace

namespace IrController {

void begin() {
  g_recv = new IRrecv(PIN_IR_RX, RX_BUFFER_SIZE, RX_TIMEOUT_MS, /*save_buffer=*/true);
  g_recv->setUnknownThreshold(MIN_UNKNOWN_SIZE);
  g_send = new IRsend(PIN_IR_TX);
  g_send->begin();
  // Receiver only enabled during a learn() call to keep loop() cheap.
}

bool send(const JsonVariantConst& payload) {
  if (!g_send) return false;
  const char* proto = payload["protocol"] | "UNKNOWN";
  JsonVariantConst decoded = payload["decoded"];
  JsonArrayConst raw = payload["raw"].as<JsonArrayConst>();

  decode_type_t t = protoFromString(proto);
  if (t != UNKNOWN && !decoded.isNull()) {
    const char* valHex = decoded["value"] | "";
    uint16_t bits = decoded["bits"] | 0;
    if (bits > 0 && strlen(valHex) > 0) {
      uint64_t value = parseHex(valHex);
      switch (t) {
        case NEC:     g_send->sendNEC(value, bits); return true;
        case SONY:    g_send->sendSony(value, bits); return true;
        case RC5:     g_send->sendRC5(value, bits); return true;
        case RC6:     g_send->sendRC6(value, bits); return true;
        case SAMSUNG: g_send->sendSAMSUNG(value, bits); return true;
        case LG:      g_send->sendLG(value, bits); return true;
        default: break;
      }
    }
  }

  // Raw fallback.
  if (raw && raw.size() > 0) {
    const size_t n = raw.size();
    auto* buf = static_cast<uint16_t*>(malloc(n * sizeof(uint16_t)));
    if (!buf) return false;
    for (size_t i = 0; i < n; ++i) {
      buf[i] = static_cast<uint16_t>(raw[i].as<uint32_t>());
    }
    g_send->sendRaw(buf, n, 38);  // 38 kHz carrier — standard for consumer IR
    free(buf);
    return true;
  }

  return false;
}

bool learn(uint32_t timeoutMs, JsonObject out) {
  if (!g_recv) return false;
  decode_results res;
  g_recv->enableIRIn();
  uint32_t start = millis();
  bool got = false;
  while (millis() - start < timeoutMs) {
    if (g_recv->decode(&res)) {
      got = true;
      break;
    }
    delay(20);
  }
  if (!got) {
    g_recv->disableIRIn();
    return false;
  }

  out["protocol"] = protoToString(res.decode_type);
  if (res.decode_type != UNKNOWN && res.bits > 0) {
    JsonObject d = out["decoded"].to<JsonObject>();
    char buf[24];
    snprintf(buf, sizeof(buf), "%llX",
             static_cast<unsigned long long>(res.value));
    d["value"] = buf;
    d["bits"] = res.bits;
  } else {
    out["decoded"] = nullptr;
  }

  JsonArray raw = out["raw"].to<JsonArray>();
  // res.rawlen includes the leading gap; index 0 is meaningless. Convert
  // ticks (50us units in IRremoteESP8266) to microseconds.
  for (uint16_t i = 1; i < res.rawlen; ++i) {
    raw.add(static_cast<uint32_t>(res.rawbuf[i]) * kRawTick);
  }

  g_recv->disableIRIn();
  return true;
}

}  // namespace IrController
