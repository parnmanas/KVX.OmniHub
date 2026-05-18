#pragma once

#include <Arduino.h>

// Persistent device configuration stored in NVS (Preferences namespace).
// Mirrors the fields the captive portal collects + the token we get from
// the server after pairing.
struct DeviceConfig {
  String wifiSsid;
  String wifiPassword;
  String serverHost;     // e.g. "omnihub.example.com" or "192.168.1.10"
  uint16_t serverPort;   // e.g. 3000
  bool tls;              // wss:// when true
  String authToken;      // empty until paired
  String pairingCode;    // 6-char code shown on the device until paired
};

namespace ConfigStore {

// Load config from NVS. Missing fields are left as defaults.
// Generates a fresh pairing code if none is stored yet.
void load(DeviceConfig& out);

// Persist the full config to NVS.
void save(const DeviceConfig& cfg);

// Wipe Wi-Fi creds, server config, and token. The pairing code is regenerated
// so the device shows a new one on the next boot.
void factoryReset();

// Convenience: returns true when wifi creds + server are set.
bool isProvisioned(const DeviceConfig& cfg);

// Generate a fresh 6-character A-Z/0-9 pairing code (no ambiguous chars).
String makePairingCode();

}  // namespace ConfigStore
