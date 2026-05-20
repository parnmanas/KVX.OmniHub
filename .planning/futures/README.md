# Future tracks

Scoping notes for planned-but-not-yet-started work. Each file captures
enough context that an engineer (or future Claude session) can pick it up
without re-litigating scope or dependencies.

## Current notes

| File | Topic | Estimated effort |
|------|-------|-----------------|
| `irdb-bulk-import.md` | Auto-convert IRDB → hundreds of IR presets | ~3.5 days |
| `mqtt-integration.md` | Native MQTT control type for Tasmota/ESPHome/Zigbee2MQTT | 2-3 days |
| `smartthings-integration.md` | Samsung SmartThings OAuth + REST | 2-3 weeks |
| `matter-integration.md` | Matter controller (requires bridge hardware) | 3-5 weeks |

## Status snapshot of the IoT control stack

| Control type | Status | Notes |
|--------------|--------|-------|
| IR | ✅ Production | Via ESP32 OmniHub |
| HTTP_API | ✅ Production | Direct from API server |
| WOL | ✅ Production | UDP magic packet from API server |
| RELAY | ✅ Production | Via ESP32 OmniHub GPIO |
| MQTT | 📄 Scoped | `mqtt-integration.md` |
| SmartThings | 📄 Scoped | `smartthings-integration.md` |
| Matter | 📄 Scoped | `matter-integration.md` |
| LG ThinQ direct | 💭 Mentioned | Probably follows SmartThings pattern |
| Google Home / Alexa | 💭 Mentioned | Lower priority for KR market |

## Recommended next-pickup order

1. **MQTT** — smallest delta, cleanest fit with current architecture
2. **SmartThings** — highest Korean-market leverage per dev-week
3. **Matter** — defer until specific customer demand or new bridge hardware
