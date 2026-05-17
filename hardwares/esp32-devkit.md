# ESP32 DevKit (USB-C, 30-pin, WROOM-32)

OmniHub 메인 컨트롤러. Wi-Fi 로 Vite/NestJS 백엔드에 WebSocket 연결, UART 로 YS-IRTM 제어.

사진: [ESP32.jpg](./ESP32.jpg)

## 개요

| 항목 | 값 |
|---|---|
| SoC | ESP32-D0WDQ6 (Dual-core Xtensa LX6 @ 240 MHz) |
| 모듈 | ESP-WROOM-32 (Wi-Fi 802.11 b/g/n + BLE 4.2) |
| 메모리 | 520 KB SRAM + 16 KB RTC SRAM + 448 KB ROM, 4 MB Flash (보통) |
| USB-Serial | CH340C 또는 CP2102 (보드마다 다름; USB-C 변형은 CH340C 가 흔함) |
| 커넥터 | USB-C |
| 핀 수 | 30 (15 × 2열) |
| 동작 전압 | 3.3V (5V 입력은 VIN/USB → 온보드 LDO) |
| GPIO 로직 | **3.3V (5V tolerant 아님)** |
| 버튼 | EN(RST), BOOT (둘 다 윗쪽) |

이 보드는 보통 **"ESP32 DevKit V1 / NodeMCU-32S 30pin USB-C"** 으로 판매됨. WROOM-32 모듈 + 30핀 변형 + USB-C 조합.

## 30-pin 핀맵

```
┌──────────────────────────────────────────┐
│        [USB-C]    [EN][BOOT]             │
│                                          │
│  3V3 ◯─                          ─◯ VIN  │
│  GND ◯─                          ─◯ GND  │
│  D15 ◯─    ┌──────────────┐      ─◯ D13  │
│   D2 ◯─    │ ESP-WROOM-32 │      ─◯ D12  │
│   D4 ◯─    │              │      ─◯ D14  │
│  D16 ◯─    │   [shield]   │      ─◯ D27  │
│  D17 ◯─    │              │      ─◯ D26  │
│   D5 ◯─    │              │      ─◯ D25  │
│  D18 ◯─    └──────────────┘      ─◯ D33  │
│  D19 ◯─                          ─◯ D32  │
│  D21 ◯─                          ─◯ D35  │
│  RX0 ◯─                          ─◯ D34  │
│  TX0 ◯─                          ─◯  VN  │
│  D22 ◯─                          ─◯  VP  │
│  D23 ◯─                          ─◯  EN  │
└──────────────────────────────────────────┘
            (안테나는 보드 아래쪽)
```

## 핀 사용 가이드

### 안전하게 쓸 수 있는 GPIO

| GPIO | 비고 |
|:---:|---|
| **4, 5, 13, 14, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33** | 범용 입출력 자유롭게 사용 |
| 16, 17 | UART2 기본 핀 (RX2 / TX2) — **YS-IRTM 연결용 권장** |
| 2 | 부트 시 LOW 권장, 보드 LED 가 연결돼 있을 수 있음 |
| 15 | 부트 시 풀업, 사용 가능하지만 부트 메시지 영향 가능 |

### 주의해야 할 핀 (strapping / input-only)

| GPIO | 주의사항 |
|:---:|---|
| **0** | BOOT 핀. LOW 면 부트로더 진입. 외부 풀다운 금지 |
| **2** | 부트 시 풀다운 필요. 외부 풀업 금지 |
| **12** | 부트 시 LOW 권장 (HIGH 면 1.8V flash 모드) |
| **15** | 부트 시 풀업 필요 |
| **34, 35, 36 (VP), 39 (VN)** | **입력 전용**. 풀업/풀다운 내부에 없음. 출력 불가 |
| **6~11** | 내장 SPI flash 와 연결, 절대 사용 금지 |
| RX0 (D3), TX0 (D1) | USB 시리얼 / 플래시. 부트 로그 출력 — 다른 용도로 쓰지 말 것 |

### ADC / DAC / I2C / SPI 기본 핀

| 기능 | 핀 |
|:---:|---|
| **ADC1** | GPIO 32, 33, 34, 35, 36(VP), 39(VN) (Wi-Fi 사용 중에도 OK) |
| ADC2 | GPIO 0, 2, 4, 12~15, 25~27 (Wi-Fi 켜지면 사용 불가) |
| **DAC** | GPIO 25, 26 |
| I2C 기본 | SDA = GPIO 21, SCL = GPIO 22 |
| SPI HSPI | MISO 12, MOSI 13, SCK 14, CS 15 |
| SPI VSPI | MISO 19, MOSI 23, SCK 18, CS 5 |
| **UART2** | RX 16, TX 17 |
| Touch | GPIO 0, 2, 4, 12, 13, 14, 15, 27, 32, 33 |

## 전원

| 입력 | 설명 |
|---|---|
| **USB-C** | 5V (PC 또는 5V 충전기). 권장. 보드의 LDO 가 3.3V 생성 |
| **VIN** | 5V 외부 (USB 미연결 시). 보호 회로 약하므로 안정 전원 권장 |
| **3V3** | 외부 3.3V 직접 공급 (LDO 우회). 사용 시 USB / VIN 분리 |
| 출력 | 3V3 핀 (~500 mA), 5V/VIN (USB 직결) |

YS-IRTM 모듈은 5V 필요 → **USB-C 로 보드에 5V 공급 → VIN 또는 5V 핀에서 YS-IRTM VCC 로 전달** 이 가장 깔끔.

## 부트 모드

- **일반 부트**: 그냥 전원 인가 또는 EN 버튼
- **다운로드 모드** (펌웨어 쓰기): BOOT 누른 채로 EN 누르고 뗌, BOOT 뗌
  - 최신 esptool / PlatformIO 는 자동으로 진입시켜주므로 보통 손댈 일 없음
- **시리얼 모니터**: 115200 baud (Arduino 기본)

## 개발 환경 권장

- **PlatformIO** (VS Code 확장) — 권장. `board = esp32dev` 또는 `nodemcu-32s`
- Arduino IDE — 동작은 함. 보드 선택 "ESP32 Dev Module" 또는 "NodeMCU-32S"
- ESP-IDF — 저수준 필요할 때

`platformio.ini` 예시:
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
upload_speed = 921600
build_flags =
  -DCORE_DEBUG_LEVEL=3
lib_deps =
  links2004/WebSockets@^2.6.1     ; or arduinoWebSockets
  bblanchon/ArduinoJson@^7.4.1
  tzapu/WiFiManager@^2.0.17
```

## YS-IRTM 와 함께 쓸 때 핀 할당 권장

| 용도 | ESP32 핀 |
|---|---|
| YS-IRTM TXD → ESP32 | **GPIO 16 (U2_RXD)** — 분압 후 |
| ESP32 → YS-IRTM RXD | **GPIO 17 (U2_TXD)** — 직결 |
| YS-IRTM VCC | VIN (5V) |
| YS-IRTM GND | GND |
| 상태 LED (선택) | GPIO 2 (보드 내장 LED) |
| Wi-Fi 리셋 버튼 (선택) | GPIO 0 (BOOT 버튼 겸용) — 5초 누르면 NVS 클리어 등 |

## Sources

- [Random Nerd Tutorials: ESP32 Pinout Reference](https://randomnerdtutorials.com/esp32-pinout-reference-gpios/) — 핀별 제약 정리
- [Last Minute Engineers: ESP32 Pinout Reference](https://lastminuteengineers.com/esp32-pinout-reference/) — 회로도 수준 설명
- [Generic ESP32 CH340 Type-C Manual](https://manuals.plus/asin/B0DBW6R8SJ) — USB-C 30핀 변형 사용자 매뉴얼
- [Espressif: ESP32 datasheet](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf) — 공식 SoC 데이터시트
