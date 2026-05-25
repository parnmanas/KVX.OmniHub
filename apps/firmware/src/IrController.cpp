#include "IrController.h"

#include <IRrecv.h>
#include <IRsend.h>
#include <IRutils.h>

namespace {
constexpr uint16_t RX_BUFFER_SIZE = 1024;
// Gap that terminates a burst. Was 50ms but that fragments NEC-family
// signals (NEC/LG/Samsung) that send command + ~100ms gap + repeat code
// into two separate captures; the second capture was a 4-edge repeat
// stub that always failed the noise filter. 90ms is short enough that
// a button release still ends the burst quickly but long enough to keep
// command+repeat together.
constexpr uint8_t RX_TIMEOUT_MS = 90;
// Floor for accepting a raw-only (UNKNOWN protocol) capture. Real consumer
// remotes are 30+ edges (simple toy remotes) up to 100+ (aircon). Ambient
// EMI / TSOP self-noise bursts are typically < 20 edges. 30 is the tradeoff
// that lets LG/NEC family pass when the library fails to label them, while
// still rejecting most noise.
constexpr uint16_t MIN_UNKNOWN_SIZE = 30;

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
  // LG2 and LG_AC both map to the LG2 decode_type — same wire format.
  // LG_AC is just a semantic flag (each value is a full AC state snapshot);
  // transmission is identical to LG2.
  if (strcmp(s, "LG2") == 0) return LG2;
  if (strcmp(s, "LG_AC") == 0) return LG2;
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
    case LG2: return "LG2";
    default: return "UNKNOWN";
  }
}

// Parse a hex string ("4A3F" or "0x4A3F") into a 64-bit value.
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

bool send(const JsonVariantConst& payload, uint16_t khz) {
  if (!g_send) return false;
  JsonArrayConst raw = payload["raw"].as<JsonArrayConst>();

  // Preferred path: server already encoded the IR signal to a raw burst.
  // This decouples the firmware from per-protocol encoders — adding a new
  // protocol is now a pure server-side change (no reflash).
  if (raw && raw.size() > 0) {
    const size_t n = raw.size();
    // Size sanity: too short = noise glitch, too long = buffer-overflow trash.
    if (n < 20) {
      Serial.printf("[ir] reject raw send: too short (%u edges)\n", (unsigned)n);
      return false;
    }
    if (n > 800) {
      Serial.printf("[ir] reject raw send: too long (%u edges) — looks like "
                    "an overflow capture\n", (unsigned)n);
      return false;
    }
    // Per-pulse sanity: real IR pulses are ~200 us to ~10 ms. Anything outside
    // 50 us .. 20000 us is implausible and almost certainly malformed.
    for (size_t i = 0; i < n; ++i) {
      uint32_t v = raw[i].as<uint32_t>();
      if (v < 50 || v > 20000) {
        Serial.printf("[ir] reject raw send: implausible pulse %u us at "
                      "index %u\n", (unsigned)v, (unsigned)i);
        return false;
      }
    }
    if (khz < 30 || khz > 60) {
      Serial.printf("[ir] khz %u out of range, clamping to 38\n", (unsigned)khz);
      khz = 38;
    }
    auto* buf = static_cast<uint16_t*>(malloc(n * sizeof(uint16_t)));
    if (!buf) return false;
    for (size_t i = 0; i < n; ++i) {
      buf[i] = static_cast<uint16_t>(raw[i].as<uint32_t>());
    }
    Serial.printf("[ir] sendRaw n=%u khz=%u\n", (unsigned)n, (unsigned)khz);
    g_send->sendRaw(buf, n, khz);
    free(buf);
    return true;
  }

  // Fallback: legacy decoded-only payload (older API server / unit tests).
  // Kept so an older API instance can still drive a new firmware, but the
  // server normally pre-encodes raw and this branch is dead code at
  // runtime. Once all deployments use the encoder, this whole block can
  // be removed (and with it the per-protocol switch, parseHex helper, and
  // protoFromString — meaningful simplification of the firmware).
  const char* proto = payload["protocol"] | "UNKNOWN";
  JsonVariantConst decoded = payload["decoded"];
  decode_type_t t = protoFromString(proto);
  if (t != UNKNOWN && !decoded.isNull()) {
    const char* valHex = decoded["value"] | "";
    uint16_t bits = decoded["bits"] | 0;
    if (bits > 0 && strlen(valHex) > 0) {
      uint64_t value = parseHex(valHex);
      Serial.printf("[ir] fallback decoded send proto=%s value=0x%llX bits=%u\n",
                    proto, (unsigned long long)value, (unsigned)bits);
      switch (t) {
        case NEC:     g_send->sendNEC(value, bits); return true;
        case SONY:    g_send->sendSony(value, bits); return true;
        case RC5:     g_send->sendRC5(value, bits); return true;
        case RC6:     g_send->sendRC6(value, bits); return true;
        case SAMSUNG: g_send->sendSAMSUNG(value, bits); return true;
        case LG:      g_send->sendLG(value, bits); return true;
        case LG2:     g_send->sendLG2(value, bits); return true;
        default:
          Serial.printf("[ir] unsupported decoded protocol: %s (decode_type=%d)\n",
                        proto, (int)t);
          return false;
      }
    }
  }

  Serial.println("[ir] send refused: no raw burst and no usable decoded fallback");
  return false;
}

bool learn(uint32_t timeoutMs, JsonObject out) {
  if (!g_recv) {
    Serial.println("[ir] ERROR: receiver not initialized (begin() not called?)");
    return false;
  }

  Serial.println("[ir] ============ LEARN START ============");
  Serial.printf("[ir] pin=GPIO%d  bufsize=%u  burst_gap=%ums  "
                "min_unknown=%u  total_timeout=%ums\n",
                PIN_IR_RX, RX_BUFFER_SIZE, (unsigned)RX_TIMEOUT_MS,
                (unsigned)MIN_UNKNOWN_SIZE, (unsigned)timeoutMs);

  // TSOP-style receivers idle HIGH and pull LOW when receiving a 38kHz burst.
  // If we see LOW with no remote pressed, wiring is wrong (no signal/no pull-up).
  // If we see HIGH then quickly LOW when remote is pressed, the pin is good.
  Serial.printf("[ir] pin level at start: %s "
                "(expect HIGH idle for TSOP38xxx)\n",
                digitalRead(PIN_IR_RX) ? "HIGH" : "LOW <- suspicious if no remote pressed");

  decode_results res;
  g_recv->enableIRIn();
  // Discard any stale capture left in the shadow buffer from a previous
  // learn() call. Without this, the very first decode() can return an old
  // burst captured before this learn() started.
  g_recv->resume();
  Serial.println("[ir] receiver enabled, shadow buffer cleared. Press the remote.");

  uint32_t start = millis();
  uint32_t lastTick = start;
  uint32_t captureCount = 0;
  bool got = false;

  while (millis() - start < timeoutMs) {
    if (g_recv->decode(&res)) {
      captureCount++;
      uint32_t elapsed = millis() - start;
      Serial.printf("[ir] #%u at t=%lums: type=%s bits=%u rawlen=%u value=0x%llX\n",
                    (unsigned)captureCount, (unsigned long)elapsed,
                    typeToString(res.decode_type).c_str(),
                    res.bits, res.rawlen,
                    (unsigned long long)res.value);

      // Dump first ~16 raw edges (in µs) so we can spot:
      //   - obvious noise (random short values like "120 80 40 60")
      //   - real signal (e.g. NEC: "9000 4500 560 560 560 1690 ...")
      //   - LG signal (similar to NEC: "9000 4500 ... 28 bits ... 560")
      if (res.rawlen > 1) {
        Serial.print("[ir]    raw[1..]:");
        const uint16_t shown = res.rawlen < 17 ? res.rawlen : 17;
        for (uint16_t i = 1; i < shown; ++i) {
          Serial.printf(" %u", (unsigned)(res.rawbuf[i] * kRawTick));
        }
        if (res.rawlen > 17) Serial.printf(" ... (+%u more)", res.rawlen - 17);
        Serial.println(" us");
      }

      const bool definitive = res.decode_type != UNKNOWN && res.bits > 0;
      // Upper bound: the longest legitimate consumer IR signal is < 600 edges
      // (large aircon protocols max around 300). Anything near the 1024-edge
      // buffer cap is a buffer-overflow capture of noise — refuse it.
      const bool acceptableRaw =
          res.rawlen >= MIN_UNKNOWN_SIZE && res.rawlen <= 800;
      if (definitive || acceptableRaw) {
        Serial.println("[ir]    -> ACCEPTED");
        got = true;
        break;
      }
      Serial.println("[ir]    -> discard (below threshold)");
      g_recv->resume();  // re-arm capture, otherwise decode() never fires again
    }

    // Heartbeat every 2s so we can tell whether the loop is alive and whether
    // any captures are accumulating but being filtered.
    uint32_t now = millis();
    if (now - lastTick >= 2000) {
      Serial.printf("[ir] ... listening (t=%lus, captures=%u, pin=%s)\n",
                    (unsigned long)((now - start) / 1000),
                    (unsigned)captureCount,
                    digitalRead(PIN_IR_RX) ? "HIGH" : "LOW");
      lastTick = now;
    }
    delay(20);
  }

  if (!got) {
    Serial.printf("[ir] ============ TIMEOUT: %u captures in %ums ============\n",
                  (unsigned)captureCount, (unsigned)timeoutMs);
    g_recv->disableIRIn();
    return false;
  }
  Serial.println("[ir] ============ LEARN OK ============");

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
  // res.rawlen includes the leading gap at index 0 (meaningless). Each
  // entry is in kRawTick (2us) units in IRremoteESP8266.
  for (uint16_t i = 1; i < res.rawlen; ++i) {
    raw.add(static_cast<uint32_t>(res.rawbuf[i]) * kRawTick);
  }

  g_recv->disableIRIn();
  return true;
}

}  // namespace IrController
