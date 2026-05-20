# Matter integration — scoping note

Status: **Not started.** Substantially harder than the other transports —
this note exists so we don't underestimate it.

## Goal

Let OmniHub act as a Matter **controller** so users can pair Matter-certified
devices (Hue bridges, Eve plugs, Aqara hubs with Matter, newer SmartThings
appliances) and trigger them from OmniHub functions.

## Why it's worth doing eventually

- The industry standard pushed by Apple/Google/Amazon/Samsung
- Local control (no vendor cloud once paired)
- Forward-compatible with new devices (more come every quarter)
- Differentiates OmniHub from "just an IR blaster" — speaks the modern stack

## Why this is NOT phase 4 work

Matter is fundamentally different from HTTP/WOL/RELAY/MQTT:

1. **Heavy SDK**
   - Reference impl is the C++ Matter SDK (~50MB+ build artifact)
   - Node.js option (`matter.js`) is functional but still maturing; some
     device types unsupported
   - Tied to OpenSSL + various crypto primitives

2. **Bluetooth LE required for commissioning**
   - Initial pairing uses BLE to exchange WiFi/Thread credentials
   - API server host needs a BLE radio (USB dongle or built-in)
   - Cloud-hosted API server can't commission devices at user sites — needs
     a local bridge

3. **Thread support is its own subproject**
   - Many Matter devices use Thread (low-power mesh) instead of WiFi
   - Requires a Thread Border Router (Raspberry Pi + 802.15.4 dongle, or
     dedicated hardware like Apple TV / Nest Hub)
   - OmniHub ESP32 doesn't currently have 802.15.4

4. **Fabric / commissioning model**
   - Devices belong to a "fabric" — you can't just pop in and out
   - Multi-admin (the device can join multiple controller ecosystems
     simultaneously) is its own non-trivial feature
   - Operational PKI and certificate handling

5. **Limited device categories**
   - Matter 1.4 covers lights, plugs, switches, locks, thermostats, blinds,
     sensors, appliances (fridge/washer/AC), EV chargers, batteries
   - **Still doesn't cover** TVs, projectors, set-top boxes, computers (WOL),
     legacy IR — i.e. exactly the things OmniHub primarily targets

## Realistic deployment shape

Matter doesn't naturally live on a cloud API server. The architecture would
likely be:

```
[ User's home/office ]
  Matter devices (Hue, Eve, etc.)
       ↑
       │ Thread / WiFi
       │
  [ OmniHub bridge node ]              ← runs matter.js, has BLE, Thread
       │ WebSocket
       ↓
  [ Cloud API ]                        ← issues abstract "play function"
```

That means we likely need a **new firmware target** — not the ESP32 hub but a
Raspberry Pi or x86 Linux box running a Matter-aware OmniHub agent — or we
extend the ESP32 firmware significantly (the ESP32-C6/H2 have Thread radios
but the current target is ESP32-WROOM with Wi-Fi only).

## Implementation breakdown

### Phase 0 — Decisions (½ day, but blocking)
- Where does the Matter controller run? Cloud API, hub firmware, or new
  bridge node? Almost certainly the third.
- What hardware spec for the bridge node? RPi 4 + Thread dongle vs ESP32-C6.
- matter.js (Node) vs Matter SDK (C++/Python)?
- Multi-tenant: how do per-user fabrics work?

### Phase 1 — Spike (2-3 days)
- Stand up matter.js example, commission one test device (Eve Energy plug
  in BLE pairing mode), verify on/off control
- Document the install/setup steps that an end-user would face

### Phase 2 — OmniHub integration (1 week+)
- New ControlType + MatterPayload (target node id + cluster + command)
- Bridge node service that holds the matter.js controller
- API ↔ bridge protocol (likely WebSocket like our current device protocol)
- Function payload UI for "pick Matter device → pick command"

### Phase 3 — Polish (1+ week)
- Commissioning flow in the UI (QR scan → BLE handshake)
- Multi-admin/fabric handling
- Device status polling/subscriptions

## Estimate

| Phase | Effort |
|-------|--------|
| 0. Decisions | ½ day |
| 1. Spike | 2-3 days |
| 2. Integration | 1-2 weeks |
| 3. Polish | 1+ week |

**Total: 3-5 weeks**, plus ongoing maintenance as Matter spec evolves
quarterly.

## Dependencies

- **Hardware**: Thread Border Router (Raspberry Pi 4 + nRF52840 USB dongle
  is the cheap path; ~150,000 KRW)
- BLE-capable host
- matter.js or equivalent SDK
- One or more Matter-certified test devices

## Recommendation

**Defer until the project has paying users specifically asking for it.**
HTTP_API + MQTT + vendor integrations (SmartThings, Google Home) cover ~95%
of practical use cases at <10% the engineering cost. Matter is the right
long-term answer but not the right starting point.
