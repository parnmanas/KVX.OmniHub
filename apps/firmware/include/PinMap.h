#pragma once

// Pin assignments. Override at build time with -D flags in platformio.ini
// if your hardware differs.

#ifndef PIN_IR_RX
#define PIN_IR_RX 15        // IR receiver data line (e.g. TSOP38238)
#endif

#ifndef PIN_IR_TX
#define PIN_IR_TX 4         // IR LED driver
#endif

#ifndef PIN_RESET_BTN
#define PIN_RESET_BTN 0     // GPIO0 (BOOT button on DevKit-C); active LOW
#endif

#ifndef PIN_STATUS_LED
#define PIN_STATUS_LED 2    // On-board LED on most ESP32 dev boards
#endif

// Long-press duration in milliseconds to trigger factory reset.
#ifndef RESET_HOLD_MS
#define RESET_HOLD_MS 5000
#endif

// ---------- Relay outputs ----------
// Number of relay channels wired to the board. Most cheap relay HATs ship as
// 1/2/4-channel; bump this and add PIN_RELAY_N defines below if you wire more.
// Channels referenced by RELAY payloads use 0-based indexing.
#ifndef PIN_RELAY_COUNT
#define PIN_RELAY_COUNT 4
#endif

// Default pin assignments — picked from "safe to use as output on ESP32 DevKit-C"
// pins (no strapping/UART/SPI conflicts). Override per channel via -D flags.
#ifndef PIN_RELAY_0
#define PIN_RELAY_0 25
#endif
#ifndef PIN_RELAY_1
#define PIN_RELAY_1 26
#endif
#ifndef PIN_RELAY_2
#define PIN_RELAY_2 27
#endif
#ifndef PIN_RELAY_3
#define PIN_RELAY_3 32
#endif

// Many cheap relay boards are active-LOW (HIGH on the input pin = relay OFF,
// LOW = relay ON). Set to 1 if your board switches on HIGH instead.
#ifndef PIN_RELAY_ACTIVE_HIGH
#define PIN_RELAY_ACTIVE_HIGH 0
#endif
