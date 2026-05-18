# OmniHub firmware (ESP32)

ESP32 펌웨어. `apps/api` WebSocket 허브와 페어링하여 IR 송수신을 수행한다.
프로토콜 정의는 [`packages/shared/src/protocol.ts`](../../packages/shared/src/protocol.ts) 와 1:1 로 맞춰져 있다.

## 1. 작업 폴더

```
apps/firmware/
├─ platformio.ini        ; 빌드 설정 (esp32dev 기본, esp32-s3 추가 env)
├─ include/
│  ├─ FirmwareVersion.h
│  └─ PinMap.h           ; 핀맵 (override 가능)
└─ src/
   ├─ main.cpp           ; setup/loop, 상태 머신
   ├─ Config.{h,cpp}     ; NVS Preferences (wifi/server/token/pairing code)
   ├─ WifiPortal.{h,cpp} ; WiFiManager 캡티브 포털
   ├─ HubClient.{h,cpp}  ; WebSocket 클라이언트 + 프로토콜
   ├─ IrController.{h,cpp}; IR 송수신 (IRremoteESP8266)
   └─ ResetButton.{h,cpp}; GPIO0 long-press(5s) → 공장 초기화
```

## 2. 하드웨어

기본 보드: **ESP32 DevKit-C (ESP32-WROOM-32)**, 4 MB flash.
필요 시 `esp32-s3` env 도 `platformio.ini` 에 정의되어 있다.

기본 핀맵 (`include/PinMap.h`):

| 기능           | GPIO | 비고                                          |
| -------------- | ---- | --------------------------------------------- |
| IR 수신        | 15   | TSOP38238 등 38kHz IR 수신모듈 (active LOW)  |
| IR 송신        | 4    | 2N2222 + IR LED 회로 (NPN base 에 220Ω)       |
| 리셋 버튼      | 0    | BOOT 버튼(내부 풀업), LOW 일 때 누름          |
| 상태 LED       | 2    | 보드 내장 LED. 인증 완료 시 HIGH              |

핀을 바꾸려면 `platformio.ini` 의 `build_flags` 에 `-DPIN_IR_RX=27` 처럼 추가하면 된다.

## 3. 사용 라이브러리

| 패키지                              | 버전     | 용도                       |
| ----------------------------------- | -------- | -------------------------- |
| `tzapu/WiFiManager`                 | ^2.0.17  | Wi-Fi 캡티브 포털         |
| `links2004/WebSockets`              | ^2.6.1   | ws/wss 클라이언트         |
| `bblanchon/ArduinoJson`             | ^7.2.0   | JSON 직렬화/역직렬화      |
| `crankyoldgit/IRremoteESP8266`      | ^2.8.6   | IR 송수신 (ESP32 도 지원) |

`pio` 가 자동으로 가져온다.

## 4. 빌드 & 플래시

전제: [PlatformIO Core](https://docs.platformio.org/en/latest/core/installation/index.html) 가 설치되어 있음.
VSCode + PlatformIO 확장이 가장 편하다.

```powershell
cd apps/firmware

# 빌드
pio run

# 빌드 + 플래시 (USB 연결 후)
pio run -t upload

# 시리얼 모니터 (115200)
pio device monitor

# ESP32-S3 보드를 쓸 때
pio run -e esp32-s3 -t upload
```

## 5. 최초 설정 (페어링)

1. **부팅** — 시리얼 모니터에 다음 배너가 찍힌다:

   ```
   ==============================================
     OmniHub firmware v0.1.0
     MAC: AA:BB:CC:DD:EE:FF
     Pairing code: 7K9M3X
     Server: ws://:0
   ==============================================
   ```

   `Pairing code` 는 NVS 에 저장되어 공장 초기화 전까지 유지된다.

2. **캡티브 포털 접속** — 다른 Wi-Fi AP `OmniHub-Setup` 이 뜬다. 폰/PC 로 접속하면
   브라우저가 자동으로 설정 페이지를 연다.
   입력 필드:
   - **SSID / Password** — 매장 Wi-Fi
   - **Server host** — API 서버 IP 또는 도메인
   - **Server port** — 기본 `3000`
   - **TLS** — `0` (ws) 또는 `1` (wss)

3. **저장 → 자동 재부팅** — 디바이스는 Wi-Fi 에 붙고 WebSocket 으로 `pair_request`
   메시지를 보낸다.

4. **관리자 페이지에서 페어링 승인** — 웹 UI `/omnihubs` 에서 시리얼에 찍힌
   페어링 코드를 입력해 claim 한다. 서버가 `pair_ack` 와 함께 영구 토큰을
   보내주고, 디바이스는 이를 NVS 에 저장한 뒤 곧바로 `hello` 로 재인증한다.

5. **상태 LED** — 인증 완료 시 GPIO2 LED 가 HIGH 로 켜진다.

## 6. 동작

- **재연결**: 소켓이 끊기면 `WebSockets` 라이브러리가 5초 간격으로 자동 재연결한다.
- **하트비트**: 서버가 30초마다 `ping` 을 보내면 즉시 `pong` 응답. 60초간 응답이 없으면
  서버가 소켓을 닫고, 디바이스는 위 재연결 로직으로 복구한다.
- **IR 송신** (`ir_send`): `protocol`+`decoded.value`+`bits` 가 있으면 해당 프로토콜로
  전송, 없으면 `raw` (µs 단위) 로 38kHz raw 송신. `repeat` N 회 반복 지원.
- **IR 학습** (`ir_learn`): 지정 `timeoutMs` 동안 수신 대기 → 디코드 성공 시
  `decoded` 채워서 송신, 실패 시 `raw` 만 채워 `protocol: "UNKNOWN"` 으로 송신.
- **토큰 무효 시**: 서버가 `invalid_token` / `unknown_device` / `pairing_required`
  에러를 주면 로컬 토큰을 폐기하고 `pair_request` 부터 다시 시작한다.

## 7. 공장 초기화

부팅 후 BOOT(GPIO0) 버튼을 5초 이상 길게 누르면 NVS 가 모두 지워지고 재부팅된다.
페어링 코드도 새로 생성된다.

부팅 순간에 버튼이 눌려 있는 경우엔 캡티브 포털이 강제로 열린다 (Wi-Fi 만 다시 설정하고
싶을 때 사용).

## 8. 향후 작업

- OTA 업데이트 (현재는 USB 플래시만 지원)
- IR 외 GPIO 릴레이/HTTP 트리거 (스키마는 `packages/shared/src/equipment.ts` 에 이미 정의)
- TLS root CA 설정 (현재 `wss` 는 클라이언트 검증 없이 연결)
