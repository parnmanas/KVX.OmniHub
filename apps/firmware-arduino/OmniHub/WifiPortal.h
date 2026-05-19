#pragma once

#include "Config.h"

namespace WifiPortal {

// Brings up Wi-Fi using saved creds. If none are saved, or `forcePortal`
// is true, opens a captive portal on AP `apSsid` and blocks until the user
// submits SSID/password + server host/port/TLS. On success, the chosen
// values are written into `cfg` and persisted.
//
// Returns true if Wi-Fi is connected when the function returns.
bool start(DeviceConfig& cfg, const char* apSsid, bool forcePortal);

}  // namespace WifiPortal
