#include "ResetButton.h"

namespace {
uint32_t s_pressStartMs = 0;
bool s_wasDown = false;
bool s_thresholdReached = false;
}  // namespace

namespace ResetButton {

void begin() {
  pinMode(PIN_RESET_BTN, INPUT_PULLUP);
}

bool poll() {
  bool down = digitalRead(PIN_RESET_BTN) == LOW;
  uint32_t now = millis();

  if (down && !s_wasDown) {
    s_pressStartMs = now;
    s_thresholdReached = false;
  } else if (down) {
    if (!s_thresholdReached && now - s_pressStartMs >= RESET_HOLD_MS) {
      s_thresholdReached = true;
    }
  } else if (!down && s_wasDown) {
    bool fired = s_thresholdReached;
    s_thresholdReached = false;
    s_wasDown = false;
    return fired;
  }

  s_wasDown = down;
  return false;
}

}  // namespace ResetButton
