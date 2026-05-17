#!/usr/bin/env node
/**
 * Fake ESP32 client for testing OmniHub WebSocket protocol.
 *
 * Usage:
 *   node tools/fake-esp32.mjs                       # new device, generate code
 *   node tools/fake-esp32.mjs --token <hex>         # reconnect existing device
 *   node tools/fake-esp32.mjs --device AA:BB:..     # override MAC
 *   node tools/fake-esp32.mjs --url ws://host:3000  # override server URL
 *
 * Stores token in tools/.fake-esp32.json so reruns are non-pairing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, ".fake-esp32.json");

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--token") args.token = argv[++i];
    else if (a === "--device") args.device = argv[++i];
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--reset") args.reset = true;
  }
  return args;
}

function randomMac() {
  const hex = () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return Array.from({ length: 6 }, hex).join(":");
}

function randomCode(length = 6) {
  const pool = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip O,0,I,1
  let s = "";
  for (let i = 0; i < length; i++)
    s += pool[Math.floor(Math.random() * pool.length)];
  return s;
}

const args = parseArgs(process.argv.slice(2));
if (args.reset) saveState({});
const state = loadState();
const url = args.url ?? "ws://localhost:3000/ws";
const deviceId = args.device ?? state.deviceId ?? randomMac();
let token = args.token ?? state.token ?? null;
const fw = "fake-0.1.0";

console.log(`[fake-esp32] deviceId=${deviceId}`);
console.log(`[fake-esp32] url=${url}`);
console.log(`[fake-esp32] token=${token ? token.slice(0, 8) + "…" : "(none)"}`);

const ws = new WebSocket(url);

ws.on("open", () => {
  console.log("[ws] open");
  if (token) {
    send({ type: "hello", deviceId, token, fw });
  } else {
    const code = randomCode();
    state.pairingCode = code;
    state.deviceId = deviceId;
    saveState(state);
    console.log(`\n========================================`);
    console.log(`  Pairing code: ${code}`);
    console.log(`========================================\n`);
    console.log(`Enter this on the web at /omnihubs ("페어링 코드 입력")`);
    send({ type: "pair_request", deviceId, pairingCode: code });
  }
});

ws.on("message", (raw) => {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    console.warn("[ws] non-JSON message", raw.toString());
    return;
  }
  console.log("[ws <-]", JSON.stringify(msg));

  switch (msg.type) {
    case "ping":
      send({ type: "pong" });
      return;
    case "pair_ack":
      token = msg.token;
      state.token = token;
      delete state.pairingCode;
      saveState(state);
      console.log(`[fake-esp32] token saved`);
      // No need to re-hello — server already promoted us to authenticated
      return;
    case "hello_ack":
      console.log(
        `[fake-esp32] authenticated, assignedEquipmentId=${msg.assignedEquipmentId}`,
      );
      return;
    case "error":
      console.error(`[ws !] ${msg.code}: ${msg.message}`);
      return;
    case "ir_learn":
      // simulate learning and respond
      setTimeout(() => {
        send({
          type: "ir_learned",
          requestId: msg.requestId,
          protocol: "NEC",
          decoded: { value: "0x20DF10EF", bits: 32 },
          raw: [9000, 4500, 560, 1690, 560, 560],
        });
      }, 800);
      return;
    case "ir_send":
      console.log(`[fake-esp32] would emit IR:`, msg.payload);
      send({ type: "ack", requestId: msg.requestId, ok: true });
      return;
  }
});

ws.on("close", (code, reason) => {
  console.log(`[ws] closed code=${code} reason=${reason.toString()}`);
  process.exit(0);
});

ws.on("error", (err) => {
  console.error(`[ws] error: ${err.message}`);
});

function send(msg) {
  console.log("[ws ->]", JSON.stringify(msg));
  ws.send(JSON.stringify(msg));
}

process.on("SIGINT", () => {
  console.log("\n[fake-esp32] shutting down");
  ws.close();
});
