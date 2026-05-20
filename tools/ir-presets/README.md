# IR Presets

Pre-built IR command payloads for common consumer electronics. Useful for
hardware bring-up testing (no need to learn from a remote first) and as a
seed for the equipment library.

## Current catalog

**TVs (8)**: LG, Samsung, Sony, Apple, Panasonic, Hisense, Toshiba, Sharp,
TCL, Philips — covers ~90% of the consumer TV market worldwide.

**Projectors (3)**: BenQ, Epson, LG — most common business and home cinema
projector brands. Includes discrete `power_on`/`power_off` codes where the
manufacturer publishes them, which is essential for automation (toggling
"power" blindly is fragile when you don't know current state).

**Soundbars (2)**: Samsung HW-series, LG SN/SK-series — covers most Korean
market soundbars and many overseas variants.

## Why no air conditioners (yet)

ACs use **stateful** protocols, not simple button-press commands. Each IR
burst encodes the entire target state — temperature + mode + fan + on/off +
swing + timer — in a long (100+ bit, sometimes 280+ bit) packet specific to
the brand. So there's no clean "AC power on" preset that works across models
the way "TV power" does.

Two correct approaches:

1. **Use the IRremoteESP8266 library's per-brand AC classes** in firmware
   (`IRLgAc`, `IRSamsungAc`, `IRDaikin`, etc.). The firmware would need a
   new control type like `IR_AC` with payload `{brand, mode, temp, fan, on}`
   instead of a raw IR signal. This is the right long-term direction.

2. **Learn from your actual remote** using the existing learn flow. Captures
   the specific state-encoded burst for that exact button. Limited to the
   states you record.

For now, AC users should use the learn flow. Adding `IR_AC` as a first-class
control type is tracked in `.planning/futures/`.

## File format

Each `<brand>-<device>.json` follows this shape:

```jsonc
{
  "brand": "LG",
  "device": "TV",
  "carrier": 38000,          // hint only; firmware uses 38kHz for raw sends
  "notes": [ "..." ],
  "commands": {
    "<command_name>": {
      "protocol": "NEC|SONY|RC5|RC6|SAMSUNG|LG|UNKNOWN",
      "decoded": { "value": "<hex>", "bits": <int> } | null,
      "raw": [<microseconds>, ...]   // used only when decoded is null
    }
  }
}
```

The `commands.<name>` value matches the `IrPayload` type from
`@omnihub/shared` exactly — the API can forward it to the device as-is.

## Quick test from the CLI

Once the API and a paired OmniHub are running, use the helper:

```bash
# 1. Get a JWT from the web login or auth endpoint, then:
export OMNIHUB_API=http://localhost:3000
export OMNIHUB_JWT='<paste token here>'

# 2. List paired hubs to find the row id:
node tools/ir-test.mjs --list

# 3. Send a preset command:
node tools/ir-test.mjs --hub <hub-row-id> --preset lg-tv --command power
node tools/ir-test.mjs --hub <hub-row-id> --preset lg-tv --command vol_up --repeat 3

# Or pass a raw payload as JSON:
node tools/ir-test.mjs --hub <hub-row-id> --raw '{"protocol":"NEC","decoded":{"value":"20DF10EF","bits":32},"raw":[]}'
```

The helper calls `POST /omnihubs/:id/ir-test` on the API, which forwards the
payload directly to the device's WebSocket — no equipment/function row needs
to exist.

## Source of truth

Codes were compiled from the IRDB (https://github.com/probonopd/irdb) and
Flipper-IRDB community datasets, then cross-checked against multiple LG TV
models. Newer LG models (2020+) may use a different protocol; if a command
doesn't trigger, use the `learn` flow to capture the actual remote.

## Adding new presets

1. Capture real IR codes via the learn flow (or pull from IRDB/Flipper-IRDB).
2. Drop a new `<brand>-<device>.json` file here following the format above.
3. Use it with the `--preset <basename>` flag (basename without `.json`).

No code changes needed — the helper auto-discovers preset files in this
directory.
