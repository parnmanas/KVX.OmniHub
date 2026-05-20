#!/usr/bin/env node
/**
 * IR test helper. Sends an IR payload to a paired OmniHub device via the
 * API's diagnostic endpoint (POST /omnihubs/:id/ir-test). Useful for
 * hardware bring-up: verify your IR transmitter works without first
 * creating an equipment + function in the database.
 *
 * Setup:
 *   export OMNIHUB_API=http://localhost:3000    # default if unset
 *   export OMNIHUB_JWT='<paste token from web login>'
 *
 * Usage:
 *   node tools/ir-test.mjs --list
 *   node tools/ir-test.mjs --list-presets
 *   node tools/ir-test.mjs --preset lg-tv --list-commands
 *   node tools/ir-test.mjs --hub <id> --preset lg-tv --command power
 *   node tools/ir-test.mjs --hub <id> --preset lg-tv --command vol_up --repeat 3
 *   node tools/ir-test.mjs --hub <id> --raw '{"protocol":"NEC","decoded":{"value":"20DF10EF","bits":32},"raw":[]}'
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = resolve(__dirname, "ir-presets");

const API = process.env.OMNIHUB_API ?? "http://localhost:3000";
const JWT = process.env.OMNIHUB_JWT ?? "";

function usage() {
  console.error(
    `\nUsage:\n` +
      `  node tools/ir-test.mjs --list                          # list paired hubs\n` +
      `  node tools/ir-test.mjs --list-presets                  # list preset files\n` +
      `  node tools/ir-test.mjs --preset <name> --list-commands # list commands in a preset\n` +
      `  node tools/ir-test.mjs --hub <id> --preset <name> --command <cmd> [--repeat <n>]\n` +
      `  node tools/ir-test.mjs --hub <id> --raw <json-payload> [--repeat <n>]\n\n` +
      `Env:\n` +
      `  OMNIHUB_API  (default: http://localhost:3000)\n` +
      `  OMNIHUB_JWT  (required for --list and --hub modes)\n`,
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--list-presets") args.listPresets = true;
    else if (a === "--list-commands") args.listCommands = true;
    else if (a === "--hub") args.hub = argv[++i];
    else if (a === "--preset") args.preset = argv[++i];
    else if (a === "--command") args.command = argv[++i];
    else if (a === "--raw") args.raw = argv[++i];
    else if (a === "--repeat") args.repeat = Number(argv[++i]);
    else if (a === "-h" || a === "--help") usage();
    else {
      console.error(`unknown argument: ${a}`);
      usage();
    }
  }
  return args;
}

function loadPreset(name) {
  const path = resolve(PRESETS_DIR, `${name}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`failed to load preset '${name}' at ${path}: ${e.message}`);
  }
}

function listPresets() {
  return readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

async function apiFetch(path, init = {}) {
  if (!JWT) {
    throw new Error("OMNIHUB_JWT env var required");
  }
  const url = `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${JWT}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${body}`);
  }
  // 204 has no body
  if (res.status === 204) return null;
  return res.json();
}

async function cmdList() {
  const hubs = await apiFetch("/omnihubs");
  if (!Array.isArray(hubs) || hubs.length === 0) {
    console.log("(no paired hubs)");
    return;
  }
  for (const h of hubs) {
    console.log(
      `${h.id}  ${h.deviceId.padEnd(17)}  ${(h.name ?? "").padEnd(20)}  ${h.status}`,
    );
  }
}

function cmdListPresets() {
  for (const name of listPresets()) {
    const p = loadPreset(name);
    const count = Object.keys(p.commands ?? {}).length;
    console.log(`${name.padEnd(20)} ${p.brand}/${p.device}  (${count} commands)`);
  }
}

function cmdListCommands(presetName) {
  const p = loadPreset(presetName);
  for (const [name, cmd] of Object.entries(p.commands ?? {})) {
    const summary = cmd.decoded
      ? `${cmd.protocol} ${cmd.decoded.value} (${cmd.decoded.bits}b)`
      : `${cmd.protocol} raw[${cmd.raw?.length ?? 0}]`;
    console.log(`  ${name.padEnd(14)} ${summary}`);
  }
}

async function cmdSend({ hub, payload, repeat }) {
  const body = repeat != null ? { payload, repeat } : { payload };
  await apiFetch(`/omnihubs/${hub}/ir-test`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(`[ok] sent to hub ${hub}`);
  if (payload.decoded) {
    console.log(
      `     ${payload.protocol} ${payload.decoded.value} (${payload.decoded.bits} bits)`,
    );
  } else {
    console.log(`     ${payload.protocol} raw[${payload.raw.length}]`);
  }
  if (repeat) console.log(`     repeat=${repeat}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    if (args.list) return await cmdList();
    if (args.listPresets) return cmdListPresets();
    if (args.listCommands) {
      if (!args.preset) {
        console.error("--list-commands requires --preset <name>");
        usage();
      }
      return cmdListCommands(args.preset);
    }

    if (!args.hub) {
      console.error("--hub <id> required");
      usage();
    }

    let payload;
    if (args.raw) {
      payload = JSON.parse(args.raw);
    } else if (args.preset && args.command) {
      const p = loadPreset(args.preset);
      payload = p.commands?.[args.command];
      if (!payload) {
        const available = Object.keys(p.commands ?? {}).join(", ");
        throw new Error(
          `command '${args.command}' not in preset '${args.preset}'. Available: ${available}`,
        );
      }
    } else {
      console.error("either --raw <json> or (--preset <name> --command <cmd>) required");
      usage();
    }

    await cmdSend({ hub: args.hub, payload, repeat: args.repeat });
  } catch (e) {
    console.error(`[error] ${e.message}`);
    process.exit(1);
  }
}

main();
