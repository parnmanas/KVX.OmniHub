#pragma once

#include <Arduino.h>

#include "Config.h"

// Speaks the OmniHub WebSocket protocol from packages/shared/src/protocol.ts.
//
// Lifecycle:
//   begin(cfg)        – open the socket
//   loop()            – pump WebSocket events and timers; call every loop tick
//   isConnected()
//   isAuthenticated() – server has accepted token (hello_ack)
//   isPaired()        – we have an authToken locally
//   onTokenReceived(cb) – called with the freshly issued token after pair_ack
namespace HubClient {

using TokenCb = void (*)(const String&);

void begin(const DeviceConfig& cfg);
void loop();

bool isConnected();
bool isAuthenticated();
bool isPaired();

void onTokenReceived(TokenCb cb);

}  // namespace HubClient
