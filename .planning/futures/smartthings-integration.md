# SmartThings integration — scoping note

Status: **Not started.** Highest-value vendor integration for the Korean
market.

## Goal

Let OmniHub control devices already registered in a user's Samsung
SmartThings account (Samsung TVs, LG appliances enrolled in SmartThings,
LIFX/Hue/Aqara through SmartThings bridges, Galaxy Home Mini routines).

## Why Korea-specific

- Samsung gear (TV/냉장고/세탁기/공기청정기) is ubiquitous and most of it
  enrolls in SmartThings rather than Matter
- LG ThinQ has its own cloud but recent appliances also expose via
  SmartThings
- Korean users frequently already have a SmartThings hub
- Covers home automation routines Korean users actually run

## Integration model

SmartThings provides a documented REST API and OAuth 2.0 flow:

```
[User] → OmniHub web UI
         "Connect SmartThings" → OAuth consent
         ← access_token + refresh_token

[OmniHub server]
   ↓ HTTPS REST
[SmartThings cloud]
   ↓
[User's devices]
```

Authentication: OAuth 2.0 with the user's Samsung account. Tokens stored
per-user in our DB.

## Implementation breakdown

### Phase 1 — Discovery / OAuth (~3 days)
- Register OmniHub as a SmartThings developer "SmartApp"
- OAuth callback endpoint, token persistence
- "Connect SmartThings" UI flow
- Token refresh job

### Phase 2 — Device sync (~2 days)
- Pull device list via `/devices` API
- Map SmartThings device → OmniHub equipment (or new linked-device table)
- Capabilities mapping (switch, level, colorControl, thermostat, etc.)

### Phase 3 — Command dispatch (~2 days)
- New `ControlType: "SMARTTHINGS"` + `SmartthingsPayload { deviceId,
  capability, command, arguments }`
- `dispatchSmartthings()` in equipments.service
- POST `/devices/{id}/commands` with the capability call

### Phase 4 — Status sync (optional, ~3 days)
- Webhook subscription for device state changes
- Or periodic poll (simpler but stale)

### Phase 5 — Production polish (~1 week)
- Token refresh handling, error recovery, rate limiting
- Multi-account support
- Disconnection / unauthorize flow

## Estimate

| Phase | Effort |
|-------|--------|
| 1. OAuth | 3 days |
| 2. Discovery | 2 days |
| 3. Commands | 2 days |
| 4. Webhooks (optional) | 3 days |
| 5. Polish | 1 week |

**Total: 2-3 weeks** depending on scope cuts.

## Dependencies

- SmartThings developer account (free, samsung.com)
- HTTPS public endpoint for OAuth callback (production)
- DB columns for OAuth tokens (encrypted at rest)
- Per-user account model in OmniHub (not just per-store)

## Open questions

- Token storage: env-encrypted columns vs KMS-managed secrets?
- Webhook callback URL — does our deployment have a stable public ingress?
- Rate limits: SmartThings caps at 250 requests/min per token. Probably fine
  for our usage but worth designing around.
- Do we treat SmartThings devices as OmniHub equipments (same model) or as
  a separate linked-devices concept? The former is cleaner UX, the latter
  is cleaner data model.

## Recommendation

**Second priority after MQTT.** SmartThings is the single highest-leverage
vendor integration for Korean users, and the engineering cost (2-3 weeks)
is modest compared to Matter (3-5 weeks) for arguably wider coverage today.
LG ThinQ direct integration could follow the same pattern as a Phase 6
addition.
