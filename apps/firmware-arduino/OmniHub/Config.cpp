#include "Config.h"

#include <Preferences.h>
#include <esp_system.h>

namespace {
constexpr const char* NS = "omnihub";

constexpr const char* K_SSID = "ssid";
constexpr const char* K_PASS = "pass";
constexpr const char* K_HOST = "host";
constexpr const char* K_PORT = "port";
constexpr const char* K_TLS = "tls";
constexpr const char* K_TOKEN = "token";
constexpr const char* K_CODE = "code";

// Ambiguous chars (0/O, 1/I/L) intentionally excluded so the printed code
// can be re-typed without confusion.
constexpr const char* CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
constexpr size_t CODE_LEN = 6;
}  // namespace

namespace ConfigStore {

void load(DeviceConfig& out) {
  Preferences p;
  p.begin(NS, /*readOnly=*/true);
  out.wifiSsid = p.getString(K_SSID, "");
  out.wifiPassword = p.getString(K_PASS, "");
  out.serverHost = p.getString(K_HOST, "");
  out.serverPort = p.getUShort(K_PORT, 3000);
  out.tls = p.getBool(K_TLS, false);
  out.authToken = p.getString(K_TOKEN, "");
  out.pairingCode = p.getString(K_CODE, "");
  p.end();

  if (out.pairingCode.length() != CODE_LEN) {
    out.pairingCode = makePairingCode();
    Preferences w;
    w.begin(NS, /*readOnly=*/false);
    w.putString(K_CODE, out.pairingCode);
    w.end();
  }
}

void save(const DeviceConfig& cfg) {
  Preferences p;
  p.begin(NS, /*readOnly=*/false);
  p.putString(K_SSID, cfg.wifiSsid);
  p.putString(K_PASS, cfg.wifiPassword);
  p.putString(K_HOST, cfg.serverHost);
  p.putUShort(K_PORT, cfg.serverPort);
  p.putBool(K_TLS, cfg.tls);
  p.putString(K_TOKEN, cfg.authToken);
  p.putString(K_CODE, cfg.pairingCode);
  p.end();
}

void factoryReset() {
  Preferences p;
  p.begin(NS, /*readOnly=*/false);
  p.clear();
  p.end();
}

bool isProvisioned(const DeviceConfig& cfg) {
  return cfg.wifiSsid.length() > 0 && cfg.serverHost.length() > 0 &&
         cfg.serverPort > 0;
}

String makePairingCode() {
  String code;
  code.reserve(CODE_LEN);
  const size_t alphaLen = strlen(CODE_ALPHABET);
  for (size_t i = 0; i < CODE_LEN; ++i) {
    code += CODE_ALPHABET[esp_random() % alphaLen];
  }
  return code;
}

}  // namespace ConfigStore
