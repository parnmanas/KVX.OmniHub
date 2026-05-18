#include "HubClient.h"

#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <WiFi.h>

#include "FirmwareVersion.h"
#include "IrController.h"

namespace {

// Heartbeat / reconnect tuned to match HEARTBEAT_INTERVAL_MS in
// packages/shared/src/protocol.ts (30s). We don't initiate pings — the
// server sends `ping` and we reply with `pong`.
constexpr uint32_t WS_RECONNECT_MS = 5000;
constexpr size_t WS_DOC_BYTES = 8192;  // big enough for raw IR captures

WebSocketsClient g_ws;
DeviceConfig g_cfg;
bool g_authenticated = false;
HubClient::TokenCb g_tokenCb = nullptr;

String deviceMac() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buf[18];
  snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

void sendJson(const JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  g_ws.sendTXT(out);
}

void sendHello() {
  JsonDocument doc;
  doc["type"] = "hello";
  doc["deviceId"] = deviceMac();
  if (g_cfg.authToken.length() > 0) doc["token"] = g_cfg.authToken;
  doc["fw"] = OMNIHUB_FW_VERSION;
  sendJson(doc);
}

void sendPairRequest() {
  JsonDocument doc;
  doc["type"] = "pair_request";
  doc["deviceId"] = deviceMac();
  doc["pairingCode"] = g_cfg.pairingCode;
  sendJson(doc);
}

void sendPong() {
  JsonDocument doc;
  doc["type"] = "pong";
  sendJson(doc);
}

void sendAck(const char* requestId, bool ok, const char* err = nullptr) {
  JsonDocument doc;
  doc["type"] = "ack";
  doc["requestId"] = requestId;
  doc["ok"] = ok;
  if (err) doc["error"] = err;
  sendJson(doc);
}

void onIrSend(const JsonDocument& msg) {
  const char* requestId = msg["requestId"] | "";
  JsonVariantConst payload = msg["payload"];
  bool ok = IrController::send(payload);
  uint8_t repeat = msg["repeat"] | 0;
  for (uint8_t i = 0; ok && i < repeat; ++i) {
    delay(40);
    ok = IrController::send(payload);
  }
  sendAck(requestId, ok, ok ? nullptr : "send_failed");
}

void onIrLearn(const JsonDocument& msg) {
  const char* requestId = msg["requestId"] | "";
  uint32_t timeoutMs = msg["timeoutMs"] | 10000;

  JsonDocument outDoc;
  outDoc["type"] = "ir_learned";
  outDoc["requestId"] = requestId;
  // protocol/decoded/raw are appended to the root object alongside
  // type/requestId so the wire shape matches IrLearnedMessage exactly.
  JsonObject body = outDoc.as<JsonObject>();
  bool ok = IrController::learn(timeoutMs, body);
  if (!ok) {
    // Spec requires `ir_learned` to have a protocol; emit UNKNOWN+empty raw.
    body["protocol"] = "UNKNOWN";
    body["decoded"] = nullptr;
    body["raw"].to<JsonArray>();
  }
  sendJson(outDoc);
}

void onMessage(uint8_t* payload, size_t length) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[ws] bad json: %s\n", err.c_str());
    return;
  }
  const char* type = doc["type"] | "";
  if (strcmp(type, "ping") == 0) {
    sendPong();
  } else if (strcmp(type, "hello_ack") == 0) {
    g_authenticated = true;
    Serial.println("[ws] authenticated");
  } else if (strcmp(type, "pair_ack") == 0) {
    const char* token = doc["token"] | "";
    if (token && *token) {
      g_cfg.authToken = token;
      ConfigStore::save(g_cfg);
      if (g_tokenCb) g_tokenCb(g_cfg.authToken);
      Serial.println("[ws] paired, token stored");
      sendHello();  // re-authenticate with the new token
    }
  } else if (strcmp(type, "ir_send") == 0) {
    onIrSend(doc);
  } else if (strcmp(type, "ir_learn") == 0) {
    onIrLearn(doc);
  } else if (strcmp(type, "error") == 0) {
    const char* code = doc["code"] | "?";
    const char* msg = doc["message"] | "";
    Serial.printf("[ws] server error %s: %s\n", code, msg);
    // pairing_required → drop our local token (must be stale) and re-pair.
    if (strcmp(code, "pairing_required") == 0 ||
        strcmp(code, "invalid_token") == 0 ||
        strcmp(code, "unknown_device") == 0) {
      g_cfg.authToken = "";
      ConfigStore::save(g_cfg);
      g_authenticated = false;
      sendPairRequest();
    }
  } else {
    Serial.printf("[ws] unknown type: %s\n", type);
  }
}

void onEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.printf("[ws] connected to %s\n", g_cfg.serverHost.c_str());
      g_authenticated = false;
      if (g_cfg.authToken.length() > 0) {
        sendHello();
      } else {
        sendPairRequest();
      }
      break;
    case WStype_DISCONNECTED:
      Serial.println("[ws] disconnected");
      g_authenticated = false;
      break;
    case WStype_TEXT:
      onMessage(payload, length);
      break;
    case WStype_ERROR:
      Serial.println("[ws] error");
      break;
    default:
      break;
  }
  (void)WS_DOC_BYTES;  // referenced for documentation
}

}  // namespace

namespace HubClient {

void begin(const DeviceConfig& cfg) {
  g_cfg = cfg;
  const char* path = "/ws";
  if (g_cfg.tls) {
    g_ws.beginSSL(g_cfg.serverHost.c_str(), g_cfg.serverPort, path);
  } else {
    g_ws.begin(g_cfg.serverHost.c_str(), g_cfg.serverPort, path);
  }
  g_ws.onEvent(onEvent);
  g_ws.setReconnectInterval(WS_RECONNECT_MS);
}

void loop() {
  g_ws.loop();
}

bool isConnected() {
  return g_ws.isConnected();
}

bool isAuthenticated() {
  return g_authenticated;
}

bool isPaired() {
  return g_cfg.authToken.length() > 0;
}

void onTokenReceived(TokenCb cb) {
  g_tokenCb = cb;
}

}  // namespace HubClient
