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

void load(DeviceConfig& out);
void save(const DeviceConfig& cfg);
void factoryReset();
bool isProvisioned(const DeviceConfig& cfg);
String makePairingCode();

}  // namespace ConfigStore
