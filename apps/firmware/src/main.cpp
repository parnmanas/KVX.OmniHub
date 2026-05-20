#include <Arduino.h>
#include <WiFi.h>
#include <esp_system.h>

#include "Config.h"
#include "FirmwareVersion.h"
#include "HubClient.h"
#include "IrController.h"
#include "PinMap.h"
#include "RelayController.h"
#include "ResetButton.h"
#include "StatusLed.h"
#include "WifiPortal.h"

namespace {
DeviceConfig g_cfg;

const char* resetReasonStr(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_POWERON:   return "POWERON";
    case ESP_RST_EXT:       return "EXT_PIN";
    case ESP_RST_SW:        return "SW_REBOOT";
    case ESP_RST_PANIC:     return "PANIC";
    case ESP_RST_INT_WDT:   return "INT_WDT";
    case ESP_RST_TASK_WDT:  return "TASK_WDT";
    case ESP_RST_WDT:       return "OTHER_WDT";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP_WAKE";
    case ESP_RST_BROWNOUT:  return "BROWNOUT";
    case ESP_RST_SDIO:      return "SDIO";
    default:                return "UNKNOWN";
  }
}

void logBootInfo() {
  Serial.println();
  Serial.println("==============================================");
  Serial.printf("[boot] OmniHub firmware v%s\n", OMNIHUB_FW_VERSION);
  Serial.printf("[boot] MAC: %s\n", WiFi.macAddress().c_str());
  Serial.printf("[boot] reset reason: %s\n",
                resetReasonStr(esp_reset_reason()));
  Serial.printf("[boot] free heap: %u bytes\n", ESP.getFreeHeap());
  Serial.printf("[boot] cpu freq: %u MHz, sdk: %s\n",
                ESP.getCpuFreqMHz(), ESP.getSdkVersion());
  Serial.println("==============================================");
}

void logLoadedConfig() {
  Serial.printf("[cfg] ssid='%s' (pass:%s)\n",
                g_cfg.wifiSsid.length() ? g_cfg.wifiSsid.c_str() : "<unset>",
                g_cfg.wifiPassword.length() ? "set" : "unset");
  Serial.printf("[cfg] server=%s://%s:%u\n",
                g_cfg.tls ? "wss" : "ws",
                g_cfg.serverHost.length() ? g_cfg.serverHost.c_str() : "<unset>",
                g_cfg.serverPort);
  Serial.printf("[cfg] token=%s, pairingCode=%s\n",
                g_cfg.authToken.length() ? "present" : "absent",
                g_cfg.pairingCode.c_str());
  Serial.printf("[cfg] provisioned=%s\n",
                ConfigStore::isProvisioned(g_cfg) ? "yes" : "no");
}

void doFactoryReset() {
  Serial.println("[btn] long-press -> factory reset, rebooting");
  ConfigStore::factoryReset();
  delay(200);
  ESP.restart();
}

// Re-derive LED state from current connectivity and apply it. Cheap: set()
// is a no-op when state is unchanged.
void refreshLedState() {
  using namespace StatusLed;
  if (HubClient::isAuthenticated()) {
    set(ONLINE);
  } else if (WiFi.status() == WL_CONNECTED) {
    set(WIFI_READY);
  } else {
    set(WIFI_SETUP);
  }
}
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(200);

  StatusLed::begin();         // LED off; state = BOOT
  logBootInfo();

  ResetButton::begin();
  ConfigStore::load(g_cfg);
  logLoadedConfig();

  IrController::begin();
  RelayController::begin();

  // If the user holds GPIO0 during boot, force the captive portal.
  bool forcePortal = digitalRead(PIN_RESET_BTN) == LOW;
  if (forcePortal) {
    Serial.println("[boot] GPIO0 held LOW at boot -> forcing setup portal");
  }

  StatusLed::set(StatusLed::WIFI_SETUP);
  if (!WifiPortal::start(g_cfg, "OmniHub-Setup", forcePortal)) {
    Serial.println("[wifi] failed; rebooting in 2s");
    delay(2000);
    ESP.restart();
  }

  StatusLed::set(StatusLed::WIFI_READY);

  if (!ConfigStore::isProvisioned(g_cfg)) {
    Serial.println("[cfg] server not configured; reopening portal");
    StatusLed::set(StatusLed::WIFI_SETUP);
    WifiPortal::start(g_cfg, "OmniHub-Setup", /*forcePortal=*/true);
    StatusLed::set(StatusLed::WIFI_READY);
  }

  Serial.printf("[boot] pairing code: %s\n", g_cfg.pairingCode.c_str());
  HubClient::begin(g_cfg);
}

void loop() {
  StatusLed::tick();
  RelayController::tick();

  if (ResetButton::poll()) {
    doFactoryReset();
  }
  HubClient::loop();
  refreshLedState();
  delay(2);
}
