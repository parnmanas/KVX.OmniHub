// OmniHub ESP32 firmware — Arduino IDE sketch.
//
// Sketch folder must be named "OmniHub" (matches this .ino).
// All sibling .h/.cpp files are auto-compiled by the Arduino IDE.
//
// See README.md in this folder for board / library setup and pairing flow.

#include <Arduino.h>
#include <WiFi.h>

#include "Config.h"
#include "FirmwareVersion.h"
#include "HubClient.h"
#include "IrController.h"
#include "PinMap.h"
#include "ResetButton.h"
#include "WifiPortal.h"

static DeviceConfig g_cfg;

static void printBanner() {
  Serial.println();
  Serial.println("==============================================");
  Serial.printf("  OmniHub firmware v%s\n", OMNIHUB_FW_VERSION);
  Serial.printf("  MAC: %s\n", WiFi.macAddress().c_str());
  Serial.printf("  Pairing code: %s\n", g_cfg.pairingCode.c_str());
  Serial.printf("  Server: %s://%s:%u\n",
                g_cfg.tls ? "wss" : "ws",
                g_cfg.serverHost.c_str(),
                g_cfg.serverPort);
  Serial.println("==============================================");
}

static void doFactoryReset() {
  Serial.println("[btn] long-press -> factory reset, rebooting...");
  ConfigStore::factoryReset();
  delay(200);
  ESP.restart();
}

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  ResetButton::begin();
  ConfigStore::load(g_cfg);
  IrController::begin();

  // If the user holds GPIO0 during boot, force the captive portal.
  bool forcePortal = digitalRead(PIN_RESET_BTN) == LOW;

  if (!WifiPortal::start(g_cfg, "OmniHub-Setup", forcePortal)) {
    Serial.println("[wifi] failed; rebooting");
    delay(2000);
    ESP.restart();
  }

  printBanner();

  if (!ConfigStore::isProvisioned(g_cfg)) {
    Serial.println("[cfg] server not configured; reopening portal");
    WifiPortal::start(g_cfg, "OmniHub-Setup", /*forcePortal=*/true);
  }

  HubClient::begin(g_cfg);
}

void loop() {
  if (ResetButton::poll()) {
    doFactoryReset();
  }
  HubClient::loop();
  digitalWrite(PIN_STATUS_LED, HubClient::isAuthenticated() ? HIGH : LOW);
  delay(2);
}
