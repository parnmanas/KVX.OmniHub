# MQTT integration — scoping note

Status: **Not started.** Captured here so we don't keep re-litigating scope.

## Goal

Let users control MQTT-based IoT devices (Tasmota, ESPHome, Zigbee2MQTT-bridged
devices, DIY ESP/Arduino projects) from OmniHub functions.

## Why it's worth doing eventually

- DIY ecosystem is huge — anyone running Tasmota or ESPHome on cheap ESP8266
  smart switches expects MQTT
- Zigbee2MQTT and similar bridges expose hundreds of Zigbee devices via MQTT
- Industrial gear and many appliances speak MQTT
- Decoupled from any specific vendor cloud

## Why HTTP_API isn't enough

Some HTTP_API users can work around this (Tasmota has both HTTP and MQTT, can
be controlled via HTTP), but native MQTT support gives:
- Lower latency (already-open connection vs HTTP handshake per call)
- State subscriptions (we can know if a switch is currently on)
- Compatibility with MQTT-only devices

## Implementation breakdown

### Decisions to make first
- **Broker:** external (user-provided Mosquitto/HiveMQ) or embedded (Aedes
  inside the API)? Embedded is easier to demo, external is more realistic.
- **State direction:** publish-only (we control devices) or also subscribe
  (we read state into DB)? Subscribe adds significant complexity.
- **Topic schema:** flat `device/<id>/cmd` style or per-vendor compatibility
  layer (Tasmota's `cmnd/<topic>/POWER` style)?

### Server-side work (~2 days)
- New `ControlType: "MQTT"` + `MqttPayload { topic, payload, qos, retain }`
- MqttModule with `mqtt` npm package, broker connection from env config
- `dispatchMqtt()` in equipments.service
- Connection lifecycle: reconnect on broker drop, queue while offline
- DTO validation: topic format, payload size limits, qos enum 0..2

### Firmware-side work
- **Likely none.** MQTT brokers and devices are reached from the API server,
  not via ESP32. The OmniHub ESP32 doesn't need to know about MQTT at all.

### Testing
- Spin up Mosquitto in docker-compose for dev/CI
- Sample Tasmota fixture (or mock client)
- End-to-end test: function play → broker → echo client → ack

## Estimate

| Phase | Effort |
|-------|--------|
| Broker decision + DTO + service skeleton | ~½ day |
| Connection lifecycle + reconnect | ~½ day |
| Tests + dev compose | ~1 day |
| Docs + sample function payload | ~½ day |

**Total: ~2-3 days**

## Dependencies

- No hardware needed beyond a running broker
- `mqtt` npm package (or `aedes` if embedded)
- Optionally `docker-compose.yml` addition

## Open questions

- Do we want bidirectional state sync, or only outbound commands?
- TLS-enabled brokers (typical for cloud) — credentials storage in env vs. DB?
- Multi-tenant: one broker shared across users, or per-user broker URL?
