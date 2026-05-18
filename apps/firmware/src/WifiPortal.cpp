#include "WifiPortal.h"

#include <WiFi.h>
#include <WiFiManager.h>

namespace WifiPortal {

bool start(DeviceConfig& cfg, const char* apSsid, bool forcePortal) {
  WiFiManager wm;
  wm.setDebugOutput(false);
  wm.setConfigPortalTimeout(0);  // run until configured
  wm.setBreakAfterConfig(true);

  // Extra parameters for server config — survive across reboots inside our
  // own Preferences store (WiFiManager only persists ssid/pass natively).
  char hostBuf[64];
  strlcpy(hostBuf, cfg.serverHost.c_str(), sizeof(hostBuf));
  char portBuf[8];
  snprintf(portBuf, sizeof(portBuf), "%u", cfg.serverPort ? cfg.serverPort : 3000);
  char tlsBuf[2];
  tlsBuf[0] = cfg.tls ? '1' : '0';
  tlsBuf[1] = '\0';

  WiFiManagerParameter pHost("host", "Server host", hostBuf, sizeof(hostBuf) - 1);
  WiFiManagerParameter pPort("port", "Server port", portBuf, sizeof(portBuf) - 1);
  WiFiManagerParameter pTls("tls", "TLS (1=wss, 0=ws)", tlsBuf, 1);
  wm.addParameter(&pHost);
  wm.addParameter(&pPort);
  wm.addParameter(&pTls);

  bool connected = false;
  if (forcePortal || cfg.wifiSsid.length() == 0) {
    connected = wm.startConfigPortal(apSsid);
  } else {
    // Try saved creds first; fall back to the portal on failure.
    WiFi.mode(WIFI_STA);
    WiFi.begin(cfg.wifiSsid.c_str(), cfg.wifiPassword.c_str());
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
      delay(250);
    }
    connected = WiFi.status() == WL_CONNECTED;
    if (!connected) {
      connected = wm.startConfigPortal(apSsid);
    }
  }

  if (!connected) return false;

  // Read back any values changed by the portal.
  cfg.wifiSsid = WiFi.SSID();
  cfg.wifiPassword = WiFi.psk();
  if (strlen(pHost.getValue()) > 0) cfg.serverHost = pHost.getValue();
  if (strlen(pPort.getValue()) > 0) {
    long parsed = strtol(pPort.getValue(), nullptr, 10);
    if (parsed > 0 && parsed < 65536) cfg.serverPort = static_cast<uint16_t>(parsed);
  }
  if (strlen(pTls.getValue()) > 0) cfg.tls = pTls.getValue()[0] == '1';

  ConfigStore::save(cfg);
  return true;
}

}  // namespace WifiPortal
