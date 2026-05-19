# OmniHub firmware — Arduino IDE sketch

Arduino IDE-compatible version of the OmniHub ESP32 firmware.
The protocol/feature set is identical to the PlatformIO version in
`apps/firmware/`; only the project layout differs.

> **Where is this?** Sketch folder is `apps/firmware-arduino/OmniHub/`.
> The folder name must match the `.ino` file name — keep it as `OmniHub`.

## 1. Open in Arduino IDE

1. Launch **Arduino IDE 2.x** (1.8.19 also works).
2. `File → Open…` → select **`apps/firmware-arduino/OmniHub/OmniHub.ino`**.
3. The IDE will load every sibling `.h`/`.cpp` automatically.

## 2. Install the ESP32 board package

`File → Preferences → Additional boards manager URLs` →
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

`Tools → Board → Boards Manager…` → install **esp32 by Espressif Systems**
(version 3.0.0 or newer recommended).

Then pick a board, e.g.:

| Hardware            | `Tools → Board`                       |
| ------------------- | ------------------------------------- |
| ESP32 DevKit-C      | `ESP32 Dev Module`                    |
| ESP32-S3 DevKit-C-1 | `ESP32S3 Dev Module`                  |

Recommended `Tools` settings: **Upload Speed 921600**, **Flash Size 4MB**,
**Partition Scheme `Default 4MB with spiffs`**, **CPU Freq 240MHz**.

## 3. Install libraries (Library Manager)

`Tools → Manage Libraries…` and install these exact names:

| Library           | Author              | Version       |
| ----------------- | ------------------- | ------------- |
| WiFiManager       | tzapu               | `>=2.0.17`    |
| WebSockets        | Markus Sattler      | `>=2.6.1`     |
| ArduinoJson       | Benoît Blanchon     | `>=7.2.0`     |
| IRremoteESP8266   | crankyoldgit        | `>=2.8.6`     |

`Preferences`, `WiFi`, and `esp_system.h` come from the ESP32 board package.

> **ArduinoJson v7** is required (the sketch uses the new `JsonDocument` API).
> If the Library Manager only shows v6, click *More info* and pick the v7
> release explicitly.

## 4. Pin map (edit `PinMap.h` if your hardware differs)

| Function    | GPIO | Notes                                          |
| ----------- | ---- | ---------------------------------------------- |
| IR receive  | 15   | TSOP38238 / VS1838B data pin                   |
| IR transmit | 4    | Through a transistor + IR LED (carrier 38 kHz) |
| Reset btn   | 0    | DevKit-C `BOOT` button, active LOW             |
| Status LED  | 2    | On-board LED (HIGH = authenticated)            |

Long-press `BOOT` (>5 s) → factory reset & reopen captive portal.
Hold `BOOT` while powering on → force captive portal even if Wi-Fi is saved.

## 5. Build & flash

1. Connect the ESP32 over USB.
2. `Tools → Port` → pick the serial port.
3. Click **Upload** (`Ctrl+U`).
4. Open **Serial Monitor** at **115200 baud** to watch logs.

## 6. First-boot / pairing flow

1. Device boots, finds no Wi-Fi → opens AP `OmniHub-Setup`.
2. Phone/PC joins that AP → captive portal asks for:
   - Wi-Fi SSID + password
   - Server **host**, **port**, **TLS** (`1` = `wss`, `0` = `ws`)
3. After saving, ESP reboots into STA mode and prints the **pairing code**
   on the serial console (6 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`).
4. In the OmniHub web app, enter the pairing code; the server responds with
   `pair_ack { token }`, which the firmware stores in NVS.
5. Subsequent boots send `hello` with the saved token and skip pairing.

If the server replies `invalid_token` / `unknown_device` / `pairing_required`,
the firmware wipes the local token and re-pairs automatically.

## 7. WebSocket protocol

Matches `packages/shared/src/protocol.ts` exactly:

**Outgoing**: `hello`, `pair_request`, `pong`, `ack`, `ir_learned`
**Incoming**: `hello_ack`, `pair_ack`, `ping`, `ir_send`, `ir_learn`, `error`

Path: `/ws` on the configured host/port (TLS-aware).

## 8. Known caveats

- `wss://` uses the WebSockets library's default TLS context with no CA
  pinning. For production deployments add `setCACert(...)` or
  `setInsecure()` in `HubClient::begin` as appropriate.
- The on-board LED is HIGH while authenticated, LOW otherwise.
- Library API drift: WiFiManager / WebSockets occasionally rename methods
  between major releases. If the build fails on `setBreakAfterConfig` or
  `beginSSL`, pin the library versions in the table above.

## 9. Relationship to `apps/firmware/`

Same source code, reorganised. Use whichever fits your workflow:

| Project              | Build system     | Layout                 |
| -------------------- | ---------------- | ---------------------- |
| `apps/firmware/`     | PlatformIO       | `src/` + `include/`    |
| `apps/firmware-arduino/OmniHub/` | Arduino IDE | flat folder, one `.ino` |

Keep them in sync — protocol changes need to land in both.
