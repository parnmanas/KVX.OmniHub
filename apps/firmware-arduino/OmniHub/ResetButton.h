#pragma once

#include <Arduino.h>

#include "PinMap.h"

// Monitors the BOOT button (GPIO0). When held continuously for RESET_HOLD_MS
// the firmware should wipe config and reboot back into the captive portal.
namespace ResetButton {

void begin();

// Call from loop(). Returns true exactly once when a long-press has just
// completed (button released after the hold threshold).
bool poll();

}  // namespace ResetButton
