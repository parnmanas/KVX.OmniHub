#include "RelayController.h"

#include "PinMap.h"

namespace {

constexpr uint8_t kChannelCount = PIN_RELAY_COUNT;
const uint8_t kPins[] = {
#if PIN_RELAY_COUNT >= 1
    PIN_RELAY_0,
#endif
#if PIN_RELAY_COUNT >= 2
    PIN_RELAY_1,
#endif
#if PIN_RELAY_COUNT >= 3
    PIN_RELAY_2,
#endif
#if PIN_RELAY_COUNT >= 4
    PIN_RELAY_3,
#endif
};
static_assert(sizeof(kPins) / sizeof(kPins[0]) == kChannelCount,
              "PinMap relay pin count mismatch — add PIN_RELAY_N entries");

// Active polarity: most cheap opto-isolated boards are active-LOW, so we
// translate logical "on" to LOW by default.
constexpr bool kActiveHigh = PIN_RELAY_ACTIVE_HIGH != 0;

struct Channel {
  bool on;
  uint32_t autoOffAtMs;  // 0 = no pending auto-off
};
Channel g_channels[kChannelCount];

void writePin(uint8_t channel, bool on) {
  digitalWrite(kPins[channel], on == kActiveHigh ? HIGH : LOW);
}

}  // namespace

namespace RelayController {

void begin() {
  for (uint8_t i = 0; i < kChannelCount; ++i) {
    pinMode(kPins[i], OUTPUT);
    g_channels[i] = {false, 0};
    writePin(i, false);
    Serial.printf("[relay] channel %u -> GPIO%u (active-%s) OFF\n",
                  (unsigned)i, (unsigned)kPins[i],
                  kActiveHigh ? "HIGH" : "LOW");
  }
}

bool set(uint8_t channel, State state, uint32_t durationMs) {
  if (channel >= kChannelCount) {
    Serial.printf("[relay] set: invalid channel %u (max %u)\n",
                  (unsigned)channel, (unsigned)(kChannelCount - 1));
    return false;
  }
  bool target;
  switch (state) {
    case ON:     target = true; break;
    case OFF:    target = false; break;
    case TOGGLE: target = !g_channels[channel].on; break;
    default:
      Serial.printf("[relay] set: unknown state %u\n", (unsigned)state);
      return false;
  }
  g_channels[channel].on = target;
  writePin(channel, target);
  if (target && durationMs > 0) {
    g_channels[channel].autoOffAtMs = millis() + durationMs;
    Serial.printf("[relay] ch%u -> ON (auto-OFF in %ums)\n",
                  (unsigned)channel, (unsigned)durationMs);
  } else {
    g_channels[channel].autoOffAtMs = 0;
    Serial.printf("[relay] ch%u -> %s\n",
                  (unsigned)channel, target ? "ON" : "OFF");
  }
  return true;
}

void tick() {
  const uint32_t now = millis();
  for (uint8_t i = 0; i < kChannelCount; ++i) {
    if (g_channels[i].autoOffAtMs != 0 &&
        (int32_t)(now - g_channels[i].autoOffAtMs) >= 0) {
      g_channels[i].on = false;
      g_channels[i].autoOffAtMs = 0;
      writePin(i, false);
      Serial.printf("[relay] ch%u -> OFF (pulse complete)\n", (unsigned)i);
    }
  }
}

bool isOn(uint8_t channel) {
  if (channel >= kChannelCount) return false;
  return g_channels[channel].on;
}

uint8_t channelCount() { return kChannelCount; }

}  // namespace RelayController
