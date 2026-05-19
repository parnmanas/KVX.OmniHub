#pragma once

#include <Arduino.h>

#include "Config.h"

// Speaks the OmniHub WebSocket protocol from packages/shared/src/protocol.ts.
namespace HubClient {

using TokenCb = void (*)(const String&);

void begin(const DeviceConfig& cfg);
void loop();

bool isConnected();
bool isAuthenticated();
bool isPaired();

void onTokenReceived(TokenCb cb);

}  // namespace HubClient
