# IRDB bulk ingestion — scoping note

Status: **Not started.** Captured because the current 15 hand-curated presets
are not enough for a real product — users need hundreds.

## Goal

Convert open IR code databases into our JSON preset format at scale so the
catalog grows from ~15 presets to ~500+ without manual transcription.

## Why not done in the current session

Cross-referencing codes manually was the quick way to add high-confidence
presets for the top-10 brands. Going beyond that means processing data
files, not typing codes, and the conversion logic is non-trivial enough that
it deserves its own pass.

## Source databases (ranked by quality)

| Source | URL | Format | Coverage | License |
|--------|-----|--------|----------|---------|
| **IRDB** | github.com/probonopd/irdb | CSV (1 per device) | ~100K codes | MIT |
| **Flipper-IRDB** | github.com/UberGuidoZ/Flipper-IRDB | `.ir` files | Most actively maintained | Unlicense |
| LIRC Remotes DB | lirc.sourceforge.net/remotes/ | LIRC config | Oldest, most comprehensive but stale | GPL |
| Global Caché | irdb.globalcache.com | Proprietary | Commercial, large | Restricted |

**Recommended primary source:** IRDB (probonopd). CSV format is trivial to
parse, structure is consistent, license is permissive.

## IRDB CSV → our JSON conversion

IRDB row shape:
```
functionname,protocol,device,subdevice,function
KEY_POWER,NEC1,4,12,8
```

For NEC1 (NEC 32-bit) the assembled value is:
```
value = (device << 24) | ((~device & 0xFF) << 16)
      | (function << 8) | (~function & 0xFF)
```

Result: `{ protocol: "NEC", decoded: { value: "04FB08F7", bits: 32 } }`

Per-protocol conversion lookup table needed for:
- NEC1, NEC2 → NEC 32-bit
- Sony12, Sony15, Sony20 → SONY (12/15/20 bits)
- RC5, RC6 → RC5/RC6
- Samsung → SAMSUNG
- Aiwa, Daikin, GreeYAR1A, Panasonic, … → either compose with library helpers or fall back to raw

## Implementation plan

### Phase 1 — Spike (½ day)
- Pull a single device CSV (e.g. `tv/LG/65UH8500/0,-1.csv`)
- Write minimal Node converter producing one preset JSON
- Verify codes match what we hand-curated for that device (sanity check)

### Phase 2 — Converter (1 day)
- Generic `tools/scripts/convert-irdb.mjs`
- Reads a list of `(brand, device, model)` triples from a manifest
- Pulls matching IRDB CSVs (clone or HTTP)
- Normalizes function names: `KEY_POWER` → `power`, `KEY_VOLUMEUP` → `vol_up`
- Emits `tools/ir-presets/<brand>-<device>.json`
- Handles protocol mapping table
- Skips/logs unsupported protocols

### Phase 3 — Curation (1 day)
- Manifest of "presets we want shipped" — top 50 TVs, top 20 ACs (raw only),
  top 10 projectors, top 10 STBs (Korean: KT/SK/LGU+)
- Run converter; commit generated files
- Add `tools/ir-presets/_generated.json` index so PresetsService can show
  badges (`auto-converted` vs `hand-curated`)

### Phase 4 — Korea-specific (½ day)
- IRDB lacks comprehensive Korean STB coverage. Manually research and add:
  - KT GiGA Genie / Olleh TV
  - SK Btv
  - LGU+ tvG
  - 삼성 Bespoke / LG ThinQ specific functions

### Phase 5 — UI surface (½ day)
- Group presets in the dropdown by category (TV / Projector / Soundbar / STB)
- Search/filter by brand
- Show "curated" vs "auto-converted" indicator (curated more trusted)

## Estimate

| Phase | Effort |
|-------|--------|
| 1. Spike | ½ day |
| 2. Converter | 1 day |
| 3. Curation | 1 day |
| 4. Korea-specific | ½ day |
| 5. UI surface | ½ day |

**Total: ~3.5 days** to go from 15 presets to ~150-500.

## Open questions

- License compatibility: IRDB is MIT, fine to bundle. Flipper-IRDB is
  Unlicense (public domain), also fine. LIRC is GPL — would taint our
  codebase if we redistributed verbatim. Decision: stick with IRDB+Flipper.
- Storage: bundle JSONs in the API repo (current approach), or move to a
  separate `@omnihub/presets` workspace package once count > 50?
- Updates: vendor the IRDB snapshot at a known commit, or pull at build
  time? Vendoring is safer (reproducible builds, offline-installable).

## Why not include MQTT/Matter/SmartThings devices

This track is strictly about **IR codes**. Network-based IoT devices belong
in their respective integration tracks (mqtt-integration.md, etc.) because
their control mechanism is fundamentally different.
