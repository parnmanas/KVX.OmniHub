# 전원 제어 가이드

장비를 켜고 끄는 방식은 장비 종류에 따라 4가지로 나뉨. 우리 시스템의 `ControlType` 과 1:1 매핑됨.

| 방식 | 적합 장비 | 추가 하드웨어 | 안전성 |
|---|---|---|:---:|
| **IR** | 에어컨, TV, 프로젝터, 셋톱박스 | YS-IRTM 만 있으면 됨 | ★★★★★ |
| **WOL** | PC, 미니 NUC (네트워크 부팅) | 추가 부품 없음 (네트워크만) | ★★★★★ |
| **HTTP_API** | 스마트 플러그, 스마트 TV, 스마트 조명, 스마트 락 | (제품 자체로 완성) | ★★★★★ |
| **RELAY** | 220V AC 부하 (조명, 콘센트, 셔터, 도어락) | 릴레이 모듈 + 배선 | ★★ (전기공사 필요) |

> **추천 우선순위**: HTTP_API ≥ IR > WOL > RELAY
> RELAY 는 직접 AC 배선을 만지는 방식이라 가능하면 **스마트 플러그/스위치(HTTP_API)** 로 우회하는 게 안전·합법·유지보수 모두에서 유리.

---

## 1. IR 제어 (이미 구현)

[ys-irtm.md](./ys-irtm.md) 참고. ESP32 + YS-IRTM 한 세트로 한 장비를 담당.

장비 추가 부품 없음. 단, 한 매장에 IR 장비가 여러 대고 위치가 떨어져 있으면 각 장비 근처에 ESP32 + YS-IRTM 세트를 따로 두는 게 좋음 (IR 은 직진성이 강함).

---

## 2. WOL — PC 전원 ON

**필요 부품**: 없음. PC 의 메인보드 BIOS 와 NIC 가 WOL 지원하면 됨.

### 동작 원리

같은 LAN 에 매직 패킷 (`FF×6 + MAC×16`, 총 102 바이트) 을 브로드캐스트하면 NIC 가 PC 를 깨움.

### 펌웨어 처리

ESP32 에서 직접 매직 패킷을 UDP 로 던질 수도 있지만, **서버에서 직접 보내는 게 더 안정적** (ESP32 는 같은 서브넷에만 깨울 수 있음). 우리는 후자로 갈 예정:

```
[Web 클릭] → [NestJS] → UDP 브로드캐스트 → [PC NIC 깨움]
```

### BIOS 설정 (한 번)

- "Wake on LAN" / "ErP" / "Deep Sleep" 등 항목을 모두 적절히 (보통 Wake on LAN: Enabled, ErP: Disabled)
- Windows: 장치 관리자 → NIC → 전원 관리 → "이 장치를 사용하여 컴퓨터의 절전 모드를 해제할 수 있음" 체크

### 끄기 (OFF)

WOL 은 켜기만 됨. 끄려면:
- OS 셧다운 명령: SSH/WinRM/PsExec 등으로 원격 셧다운
- 강제 차단: 스마트 플러그 (HTTP_API) 또는 릴레이로 AC 차단 (마지막 수단)

---

## 3. HTTP_API — 스마트 디바이스

**추가 부품 없음** (제품 자체로 완성). 가장 안전하고 권장.

### 카테고리별 추천 제품

#### 스마트 플러그 (콘센트 단위 전원 차단)

| 제품 | API | 가격대 | 특징 |
|---|---|---|---|
| **Shelly Plus 1** | 로컬 HTTP/MQTT | ~3만원 | 클라우드 없이 완전 로컬 제어. **강력 추천** |
| **Shelly Plug S** | 로컬 HTTP | ~4만원 | 콘센트형, 16A |
| **Sonoff S31 / Mini** | Tasmota 펌웨어로 교체하면 HTTP | ~2만원 | 펌웨어 교체 필요 (저렴) |
| Tuya / SmartThings | 클라우드 API | 다양 | 인터넷 의존, 로컬 안 됨 |

가장 추천하는 건 **Shelly Plus 1** — 콘센트 안에 들어가는 in-wall 모듈이라 깔끔하고, 로컬 IP 로 HTTP GET 한 방으로 제어 가능:

```
GET http://192.168.0.50/relay/0?turn=on
GET http://192.168.0.50/relay/0?turn=off
GET http://192.168.0.50/status      ← 현재 상태 조회
```

#### 스마트 조명

- **Philips Hue** — Hue Bridge 통해 로컬 HTTP API (https://192.168.x.x/api/...)
- **Aqara/Ikea Tradfri** — Zigbee 허브 필요
- **WiFi 직접 연결 전구** (Yeelight, LIFX) — 자체 HTTP/UDP API

#### 스마트 TV

- 삼성: Tizen WebSocket API (`ws://tv-ip:8002/api/v2/...`)
- LG: webOS HTTP API (Pairing 후 토큰 발급)
- 일반 TV: HDMI-CEC 로 ON, IR 로 OFF 조합

#### 스마트 도어락

- **Aqara U100/U200** — Matter/HomeKit 지원
- **Yale, Samsung** — 일부 모델 BLE/API
- 대안: 기존 전기정 + 릴레이 (아래 RELAY 섹션)

### 우리 시스템에서

`HttpApiPayload` 가 이미 정의돼 있음:

```ts
interface HttpApiPayload {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}
```

서버(NestJS) 가 직접 호출 → 결과 ControlLog 로 기록. ESP32 경유 안 함.

---

## 4. RELAY — AC 부하 직접 차단

**필요 부품 (1채널 기준)**

| 부품 | 모델 예시 | 가격 | 용도 |
|---|---|---|---|
| **5V 릴레이 모듈** | SRD-05VDC-SL-C 기반 1ch 모듈 (옵토커플러 포함) | 2,000~5,000원 | 저전류 부하 (조명, 도어락) |
| **SSR (Solid State Relay)** | Fotek SSR-25DA (DC→AC), SSR-25DD (DC→DC) | 5,000~15,000원 | 무소음, 잦은 스위칭 |
| **컨택터 (Magnetic Contactor)** | LS MC-9b 등 | 15,000~30,000원 | 대전류 (셔터, 에어컨 메인) |
| 12V 어댑터 | SMPS 12V 1A | 5,000원 | 도어락/전기정 전원 |
| 점퍼선 | DuPont F/F, F/M | 3,000원 | ESP32 ↔ 릴레이 |

### 회로 예시 — 조명 ON/OFF

```
              ┌──── L (AC 라이브) ────┐
              │                     │
   AC 220V    │   ┌─────────┐       │
   메인 입력 ──┼───│ Relay   │───────┼─── 전등
              │   │  Module │       │
              └───│         │───────┘
                  │         │
                  │ IN  ────┼──── ESP32 GPIO (HIGH/LOW)
                  │ VCC ────┼──── ESP32 5V (VIN)
                  │ GND ────┼──── ESP32 GND
                  └─────────┘
```

### ESP32 코드 예시

```cpp
#define RELAY_PIN 23  // 임의 GPIO (strapping 핀 피하기)
// 주의: 대부분의 중국산 릴레이 모듈은 **LOW Active** (IN=LOW 일 때 ON)

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // 시작 시 OFF
}

void relayOn()  { digitalWrite(RELAY_PIN, LOW); }
void relayOff() { digitalWrite(RELAY_PIN, HIGH); }
```

### 안전 주의사항 ⚠️

1. **AC 220V 작업은 자격 있는 전기공에게 의뢰**. 우리(개발자)가 만지면 화재·감전 위험 + 전기사업법 위반
2. **옵토커플러 절연**: 싸구려 모듈 중 절연 없는 것이 있음. 반드시 옵토커플러(PC817) 가 보드에 박힌 모듈 선택
3. **별도 전원**: 릴레이 코일(70mA) 이 ESP32 5V 핀에서 빠지면 ESP32 가 불안정해질 수 있음 → 별도 5V 어댑터로 릴레이 모듈 VCC 공급, GND 만 공통
4. **플라이백 다이오드**: 릴레이 모듈에 이미 내장 (1N4007). 보드 없이 릴레이 단독으로 쓰면 직접 추가 필요
5. **퓨즈**: AC 측에 반드시 퓨즈 (정격의 1.5배)
6. **셔터/모터 대전류**: 일반 5V 릴레이로 직접 못 켬. 5V 릴레이 → 컨택터 코일 → 컨택터 본접점 → 모터 식으로 단을 나눠야 함

### 도어락 (전기정/마그네틱) 예시

```
                       ┌──── + ───────┐
                       │              │
   12V 어댑터  + ──────┘      ┌─────┐ │
              -                │  전 │ │
              │     ┌─────┐    │  기 │ │
              ├─────│Relay│────│  정 │ │
              │     │ NO  │    └─────┘ │
              │     │  COM├─────────────┘
              │     └─────┘
              │
              GND ←── ESP32 GND 공통
```

대부분 **NO (Normally Open) 접점** 사용 — 평상시 잠금, 펄스로 잠시 통전하면 락이 풀림 (보통 3~5초). 정전 시 잠금 유지하는 "fail-secure" 와 풀리는 "fail-safe" 가 있으니 용도에 맞게 선택.

### PC 강제 OFF (전원 버튼 시뮬레이션)

PC 메인보드의 **PWR_SW 핀 헤더(2핀)** 에 릴레이 NO 접점을 병렬 연결:

```
   메인보드 PWR_SW ─┬─ 릴레이 NO ─┐
                  └────────────┴── (릴레이가 200ms 닫히면 단누름 = ON 또는 일반 OFF)
                                  (4초 닫혀 있으면 강제 OFF)
```

WOL 로 ON, OS 셧다운으로 OFF 가 정상 동작 안 할 때 마지막 수단.

---

## 무인 매장 추천 구성

| 장비 | 추천 방식 | 부품 | 비용 |
|---|---|---|---|
| 에어컨 | IR | YS-IRTM | 5천원 |
| 매장 TV | IR + HDMI-CEC | YS-IRTM (TV ON/OFF/음량), HDMI-CEC (PC→TV ON) | 5천원 |
| 프로젝터 | IR | YS-IRTM | 5천원 |
| 매장 PC | WOL ON + OS shutdown OFF | (없음) | 0원 |
| PC 강제 차단 | HTTP_API (스마트 플러그) | Shelly Plus 1 | 3만원 |
| 매장 조명 (그룹 1) | HTTP_API (스마트 스위치) | Shelly Plus 1 인-월 | 3만원 |
| 도어락 (출입) | HTTP_API | Aqara U100 또는 기존 락 + 스마트 플러그 | 5~15만원 |
| 셔터 | 전기공사 의뢰 (220V) | 컨택터 + Shelly Pro 1 | 10만원 + 공사비 |
| 정수기/콘센트 | HTTP_API (스마트 플러그) | Shelly Plug S | 4만원/개 |

> 결론: **릴레이 직접 배선은 가능하면 피하고, Shelly 같은 인증된 스마트 모듈로 우회하는 게 현명**. ESP32 + YS-IRTM 한 세트는 IR 장비 묶음을 모두 커버할 수 있어 핵심 부품으로 유지.

---

## 우리 시스템 매핑

각 방식이 `EquipmentFunction.payload` 에 어떻게 들어가는지:

```ts
// IR (에어컨 전원)
{ controlType: "IR", data: { protocol: "NEC", decoded: { value: "0x20DF10EF", bits: 32 }, raw: [] } }

// WOL (매장 PC)
{ controlType: "WOL", data: { mac: "AA:BB:CC:DD:EE:FF", broadcastIp: "192.168.0.255" } }

// HTTP_API (Shelly Plus 1 전등 ON)
{ controlType: "HTTP_API", data: { method: "GET", url: "http://192.168.0.50/relay/0?turn=on" } }

// RELAY (ESP32 직결 도어락 펄스)
{ controlType: "RELAY", data: { channel: 0, state: "ON", durationMs: 3000 } }
```

- IR / RELAY → ESP32 가 처리 (펌웨어가 채널 번호 받아서 GPIO 토글)
- WOL / HTTP_API → 서버가 직접 처리 (ESP32 거치지 않음)

따라서 ESP32 펌웨어가 처리해야 할 건 **IR + 선택적 RELAY** 두 가지. RELAY 모듈을 묶으면 ESP32 한 대로 "이 매장 IR 1개 + 도어락 1개" 같은 다중 역할도 가능.

---

## Sources

- [Shelly Plus 1 docs](https://shelly-api-docs.shelly.cloud/gen2/) — Gen2 로컬 HTTP/RPC
- [Tasmota docs](https://tasmota.github.io/docs/) — Sonoff 펌웨어 교체
- [WOL Wikipedia](https://en.wikipedia.org/wiki/Wake-on-LAN) — 매직 패킷 구조
- [Fotek SSR datasheet](https://www.fotek.com.tw/) — SSR 사양
- [LS산전 컨택터 카탈로그](https://www.lselectric.co.kr/) — MC-9b 등 산업용
