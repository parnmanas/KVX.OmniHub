#pragma once

// Pin assignments. Edit values here if your hardware differs (Arduino IDE
// does not honour -D build flags from PlatformIO).

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
