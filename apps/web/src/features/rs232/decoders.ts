// Brand-specific RS232 response decoders.
//
// The firmware hands back the projector's reply as a hex string. Raw hex
// is useless to operators, so we map (brand, commandName, hex) to a small
// {label, value} that the UI can render as "전원: 켜짐" instead of
// "2A504F573D4F4E23".
//
// Why client-side (not server-side):
//   - Brand identification is best inferred from the preset name or the
//     equipment's manufacturer, both of which the UI already knows.
//   - Display formatting (locale, units, color cues) is purely UI concern.
//   - Adding a new brand decoder = one file, no API/firmware redeploy.
//
// Adding a new brand: implement a Decoder, then register it in BRAND_DECODERS
// keyed by lowercase brand string. The matcher pulls "benq" from
// equipment.manufacturer = "BenQ" or from preset name prefix.

export interface DecodedField {
  label: string; // Korean human-readable label, e.g. "전원"
  value: string; // formatted value, e.g. "켜짐"
  unit?: string; // optional unit suffix, e.g. "시간"
}

export type CommandDecoder = (responseHex: string) => DecodedField | null;
export type BrandDecoder = Record<string, CommandDecoder>;

// ---------- helpers ----------

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(b)) return out;
    out.push(b);
  }
  return out;
}

function hexToAscii(hex: string): string {
  let s = "";
  for (const b of hexToBytes(hex)) {
    if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += " ";
  }
  return s;
}

function onOff(val: string): string {
  const v = val.trim().toUpperCase();
  if (v === "ON" || v === "1" || v === "TRUE") return "켜짐";
  if (v === "OFF" || v === "0" || v === "FALSE") return "꺼짐";
  return val;
}

// ---------- BenQ ASCII (e.g. *POW=ON#) ----------
//
// All BenQ replies wrap the answer like *<KEY>=<VAL>#. We pull <VAL> with a
// permissive regex so trailing CRs and the start byte don't break parsing.

function benqMatch(hex: string, key: string): string | null {
  const a = hexToAscii(hex);
  const m = a.match(new RegExp(`\\*${key}=([^#]+)#`, "i"));
  return m ? m[1].trim() : null;
}

const benq: BrandDecoder = {
  query_power_state: (hex) => {
    const v = benqMatch(hex, "POW");
    if (v === null) return null;
    return { label: "전원", value: onOff(v) };
  },
  query_input_source: (hex) => {
    const v = benqMatch(hex, "SOUR");
    if (v === null) return null;
    return { label: "입력", value: v.toUpperCase() };
  },
  query_lamp_hours: (hex) => {
    const v = benqMatch(hex, "LTIM");
    if (v === null) return null;
    return { label: "램프 사용시간", value: v, unit: "시간" };
  },
  query_lamp_state: (hex) => {
    const v = benqMatch(hex, "LAMP");
    if (v === null) return null;
    return { label: "램프 모드", value: v };
  },
  query_model_name: (hex) => {
    const v = benqMatch(hex, "MODELNAME");
    if (v === null) return null;
    return { label: "모델", value: v };
  },
  query_mute_audio: (hex) => {
    const v = benqMatch(hex, "MUTE");
    if (v === null) return null;
    return { label: "음소거", value: onOff(v) };
  },
  query_mute_video: (hex) => {
    const v = benqMatch(hex, "BLANK");
    if (v === null) return null;
    return { label: "영상 차단", value: onOff(v) };
  },
  query_volume: (hex) => {
    const v = benqMatch(hex, "VOL");
    if (v === null) return null;
    return { label: "볼륨", value: v };
  },
  query_aspect_ratio: (hex) => {
    const v = benqMatch(hex, "ASP");
    if (v === null) return null;
    return { label: "화면비", value: v };
  },
  query_brightness: (hex) => {
    const v = benqMatch(hex, "BRI");
    if (v === null) return null;
    return { label: "밝기", value: v };
  },
  query_contrast: (hex) => {
    const v = benqMatch(hex, "CON");
    if (v === null) return null;
    return { label: "대비", value: v };
  },
};

// ---------- Epson ESC/VP21 (e.g. PWR=01:OK\r) ----------
//
// Epson replies look like KEY=VAL\r or :OK / ERR. PWR maps 00=off, 01=on,
// 02=warming, 03=cooling. LAMP returns decimal hours.

function epsonMatch(hex: string, key: string): string | null {
  const a = hexToAscii(hex);
  const m = a.match(new RegExp(`${key}=([0-9A-Fa-f]+)`, "i"));
  return m ? m[1] : null;
}

const epsonPowerStates: Record<string, string> = {
  "00": "대기 (꺼짐)",
  "01": "켜짐",
  "02": "워밍업",
  "03": "쿨다운",
  "04": "이상 대기",
  "05": "이상",
};

const epson: BrandDecoder = {
  query_power_state: (hex) => {
    const v = epsonMatch(hex, "PWR");
    if (v === null) return null;
    return { label: "전원", value: epsonPowerStates[v] ?? `상태 ${v}` };
  },
  query_input_source: (hex) => {
    const v = epsonMatch(hex, "SOURCE");
    if (v === null) return null;
    return { label: "입력", value: `소스 0x${v}` };
  },
  query_lamp_hours: (hex) => {
    const v = epsonMatch(hex, "LAMP");
    if (v === null) return null;
    return { label: "램프 사용시간", value: String(parseInt(v, 10)), unit: "시간" };
  },
  query_lamp_state: (hex) => {
    const v = epsonMatch(hex, "LAMP");
    if (v === null) return null;
    return { label: "램프", value: v };
  },
  query_error_status: (hex) => {
    const v = epsonMatch(hex, "ERR");
    if (v === null) return null;
    const ok = v === "00";
    return { label: "에러", value: ok ? "정상" : `에러 코드 ${v}` };
  },
  query_mute_video: (hex) => {
    const v = epsonMatch(hex, "MUTE");
    if (v === null) return null;
    return { label: "영상 차단", value: v === "ON" ? "켜짐" : "꺼짐" };
  },
  query_volume: (hex) => {
    const v = epsonMatch(hex, "VOL");
    if (v === null) return null;
    return { label: "볼륨", value: String(parseInt(v, 16)) };
  },
  query_aspect_ratio: (hex) => {
    const v = epsonMatch(hex, "ASPECT");
    if (v === null) return null;
    return { label: "화면비", value: v };
  },
};

// ---------- Optoma ASCII (e.g. ~XX124 1\r reply: Ok1) ----------
//
// Optoma replies are short: "Ok<value>\r" or "F\r" on failure. The value
// is usually 0/1 for booleans or a decimal for hours.

function optomaValue(hex: string): string | null {
  const a = hexToAscii(hex).trim();
  if (a === "F" || a === "FAIL") return null;
  const m = a.match(/Ok(\S+)/);
  return m ? m[1] : null;
}

const optoma: BrandDecoder = {
  query_power_state: (hex) => {
    const v = optomaValue(hex);
    if (v === null) return null;
    return { label: "전원", value: v === "1" ? "켜짐" : "꺼짐" };
  },
  query_input_source: (hex) => {
    const v = optomaValue(hex);
    if (v === null) return null;
    const sources: Record<string, string> = {
      "1": "HDMI 1",
      "2": "HDMI 2",
      "3": "VGA 1",
      "4": "VGA 2",
      "5": "S-Video",
      "6": "Video",
      "7": "BNC",
      "8": "DisplayPort",
    };
    return { label: "입력", value: sources[v] ?? `소스 ${v}` };
  },
  query_lamp_hours: (hex) => {
    const v = optomaValue(hex);
    if (v === null) return null;
    return { label: "램프 사용시간", value: v, unit: "시간" };
  },
  query_model_name: (hex) => {
    const v = optomaValue(hex);
    if (v === null) return null;
    return { label: "모델", value: v };
  },
  query_firmware_version: (hex) => {
    const v = optomaValue(hex);
    if (v === null) return null;
    return { label: "펌웨어", value: v };
  },
  query_error_status: (hex) => {
    const v = optomaValue(hex);
    if (v === null) return null;
    return { label: "에러", value: v === "0" ? "정상" : `에러 ${v}` };
  },
};

// ---------- Christie ASCII ((PWR!000)) ----------
//
// Christie replies wrap the value as (KEY!NNN[ payload]). For booleans NNN
// is 000/001; for strings it's a label.

function christieValue(hex: string, key: string): string | null {
  const a = hexToAscii(hex);
  const m = a.match(new RegExp(`\\(${key}!([^\\)]*)\\)`, "i"));
  return m ? m[1].trim() : null;
}

const christie: BrandDecoder = {
  query_power_state: (hex) => {
    const v = christieValue(hex, "PWR");
    if (v === null) return null;
    const code = v.split(/\s+/)[0];
    return {
      label: "전원",
      value: code === "001" || code === "1" ? "켜짐" : "꺼짐",
    };
  },
  query_input_source: (hex) => {
    const v = christieValue(hex, "SRC");
    if (v === null) return null;
    return { label: "입력", value: v };
  },
  query_lamp_hours: (hex) => {
    const v = christieValue(hex, "LPH");
    if (v === null) return null;
    return { label: "램프 사용시간", value: v, unit: "시간" };
  },
  query_error_status: (hex) => {
    const v = christieValue(hex, "SST");
    if (v === null) return null;
    return { label: "시스템 상태", value: v };
  },
  query_serial_number: (hex) => {
    const v = christieValue(hex, "SNO");
    if (v === null) return null;
    return { label: "S/N", value: v };
  },
  query_firmware_version: (hex) => {
    const v = christieValue(hex, "VER");
    if (v === null) return null;
    return { label: "펌웨어", value: v };
  },
  query_brightness: (hex) => {
    const v = christieValue(hex, "BRT");
    if (v === null) return null;
    return { label: "밝기", value: v };
  },
  query_contrast: (hex) => {
    const v = christieValue(hex, "CON");
    if (v === null) return null;
    return { label: "대비", value: v };
  },
  query_aspect_ratio: (hex) => {
    const v = christieValue(hex, "SZP");
    if (v === null) return null;
    return { label: "화면비", value: v };
  },
  query_mute_video: (hex) => {
    const v = christieValue(hex, "SHU");
    if (v === null) return null;
    return { label: "셔터", value: v === "001" ? "닫힘" : "열림" };
  },
  query_model_name: (hex) => {
    const v = christieValue(hex, "MDL");
    if (v === null) return null;
    return { label: "모델", value: v };
  },
};

// ---------- InFocus ASCII ((PWR1)) ----------
// Same shape as Christie's wrapped form but without the !.

function infocusValue(hex: string, key: string): string | null {
  const a = hexToAscii(hex);
  const m = a.match(new RegExp(`\\(${key}([^\\)]*)\\)`, "i"));
  return m ? m[1].trim() : null;
}

const infocus: BrandDecoder = {
  query_power_state: (hex) => {
    const v = infocusValue(hex, "PWR");
    if (v === null) return null;
    return { label: "전원", value: v === "1" ? "켜짐" : "꺼짐" };
  },
  query_input_source: (hex) => {
    const v = infocusValue(hex, "SRC");
    if (v === null) return null;
    return { label: "입력", value: v };
  },
  query_lamp_hours: (hex) => {
    const v = infocusValue(hex, "LMP");
    if (v === null) return null;
    return { label: "램프 사용시간", value: v, unit: "시간" };
  },
  query_lamp_state: (hex) => {
    const v = infocusValue(hex, "LST");
    if (v === null) return null;
    return { label: "램프 상태", value: v };
  },
  query_model_name: (hex) => {
    const v = infocusValue(hex, "MDL");
    if (v === null) return null;
    return { label: "모델", value: v };
  },
  query_firmware_version: (hex) => {
    const v = infocusValue(hex, "VER");
    if (v === null) return null;
    return { label: "펌웨어", value: v };
  },
  query_mute_audio: (hex) => {
    const v = infocusValue(hex, "MTA");
    if (v === null) return null;
    return { label: "음소거", value: v === "1" ? "켜짐" : "꺼짐" };
  },
  query_mute_video: (hex) => {
    const v = infocusValue(hex, "MTV");
    if (v === null) return null;
    return { label: "영상 차단", value: v === "1" ? "켜짐" : "꺼짐" };
  },
  query_volume: (hex) => {
    const v = infocusValue(hex, "VOL");
    if (v === null) return null;
    return { label: "볼륨", value: v };
  },
  query_aspect_ratio: (hex) => {
    const v = infocusValue(hex, "ASP");
    if (v === null) return null;
    return { label: "화면비", value: v };
  },
};

// ---------- Panasonic ASCII (\x02PON\x03 etc) ----------
//
// Panasonic encloses replies in STX/ETX with the response keyword inside.
// Power: PON / POF. Input: e.g. IIS:HD1.

function panasonicBody(hex: string): string {
  const bytes = hexToBytes(hex);
  // Strip STX (0x02) and ETX (0x03) and any leading PJID.
  const text = bytes
    .filter((b) => b >= 0x20 && b < 0x7f)
    .map((b) => String.fromCharCode(b))
    .join("");
  return text;
}

const panasonic: BrandDecoder = {
  query_power_state: (hex) => {
    const a = panasonicBody(hex);
    if (a.includes("PON")) return { label: "전원", value: "켜짐" };
    if (a.includes("POF")) return { label: "전원", value: "꺼짐" };
    return null;
  },
  query_input_source: (hex) => {
    const a = panasonicBody(hex);
    const m = a.match(/IIS:?([A-Z0-9]+)/i);
    if (!m) return null;
    const inputs: Record<string, string> = {
      HD1: "HDMI 1",
      HD2: "HDMI 2",
      RG1: "RGB 1",
      RG2: "RGB 2",
      VID: "Video",
      SVD: "S-Video",
      DVI: "DVI",
      NWP: "Network",
    };
    return { label: "입력", value: inputs[m[1]] ?? m[1] };
  },
  query_lamp_hours: (hex) => {
    const a = panasonicBody(hex);
    const m = a.match(/Q\$L\s*:?\s*(\d+)/);
    if (!m) return { label: "램프", value: a };
    return { label: "램프 사용시간", value: m[1], unit: "시간" };
  },
  query_mute_video: (hex) => {
    const a = panasonicBody(hex);
    if (a.includes("OSH:1") || a.includes("OSH:ON"))
      return { label: "셔터", value: "닫힘" };
    if (a.includes("OSH:0") || a.includes("OSH:OFF"))
      return { label: "셔터", value: "열림" };
    return null;
  },
  query_freeze: (hex) => {
    const a = panasonicBody(hex);
    if (a.includes("OFZ:1")) return { label: "정지화면", value: "켜짐" };
    if (a.includes("OFZ:0")) return { label: "정지화면", value: "꺼짐" };
    return null;
  },
};

// ---------- Sharp ASCII (POWR   1\r etc — 8-char padded) ----------

function sharpField(hex: string): string {
  return hexToAscii(hex).trim();
}

const sharp: BrandDecoder = {
  query_power_state: (hex) => {
    const v = sharpField(hex);
    if (/^0+$/.test(v)) return { label: "전원", value: "꺼짐" };
    if (/^0*1$/.test(v)) return { label: "전원", value: "켜짐" };
    if (v === "OK") return { label: "전원", value: "OK" };
    return null;
  },
  query_input_source: (hex) => {
    const v = sharpField(hex);
    if (!v) return null;
    return { label: "입력", value: v };
  },
  query_lamp_hours: (hex) => {
    const v = sharpField(hex);
    if (!v || !/^\d+$/.test(v)) return null;
    return { label: "램프 사용시간", value: v, unit: "시간" };
  },
  query_lamp_state: (hex) => {
    const v = sharpField(hex);
    if (!v) return null;
    return { label: "램프 상태", value: v };
  },
  query_mute_video: (hex) => {
    const v = sharpField(hex);
    return {
      label: "영상 차단",
      value: /^0*1$/.test(v) ? "켜짐" : "꺼짐",
    };
  },
};

// ---------- NEC Binary (0x20..0x23 reply opcode) ----------
//
// NEC's status replies are 7+ bytes: 20H+opcode, projID, len, data..., CKS.
// We parse the data block per command. Reference: BDT140013 rev 7.1.

const nec: BrandDecoder = {
  query_power_state: (hex) => {
    const b = hexToBytes(hex);
    // Reply: 20 85 00 00 02 <power-state> <data> CKS
    // power-state byte: 00=standby, 01=power-on cooling, 04=on, ...
    if (b.length < 8) return null;
    const state = b[5];
    const map: Record<number, string> = {
      0x00: "대기",
      0x01: "전원 켜는 중",
      0x04: "켜짐",
      0x05: "쿨다운",
      0x06: "절전 대기",
      0x0f: "절전",
    };
    return { label: "전원", value: map[state] ?? `상태 0x${state.toString(16)}` };
  },
  query_input_source: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 8) return null;
    const code = b[5];
    const map: Record<number, string> = {
      0x01: "RGB1",
      0x02: "RGB2",
      0x03: "Component",
      0x06: "HDMI 1",
      0x07: "HDMI 2",
      0x0a: "Video",
      0x0b: "S-Video",
      0x14: "USB Viewer",
      0x1f: "Network",
    };
    return { label: "입력", value: map[code] ?? `0x${code.toString(16)}` };
  },
  query_lamp_hours: (hex) => {
    const b = hexToBytes(hex);
    // Reply: 23 8A 00 00 06 <type> <lamp#> <unit> <hours LE 4 bytes> CKS
    if (b.length < 13) return null;
    const lo = b[8],
      h1 = b[9],
      h2 = b[10],
      hi = b[11];
    const hours = lo | (h1 << 8) | (h2 << 16) | (hi << 24);
    return { label: "램프 사용시간", value: String(hours), unit: "시간" };
  },
  query_filter_hours: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 13) return null;
    const lo = b[8],
      h1 = b[9],
      h2 = b[10],
      hi = b[11];
    const hours = lo | (h1 << 8) | (h2 << 16) | (hi << 24);
    return { label: "필터 사용시간", value: String(hours), unit: "시간" };
  },
  query_error_status: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 10) return null;
    const e1 = b[5];
    if (e1 === 0) return { label: "에러", value: "정상" };
    return { label: "에러", value: `0x${e1.toString(16).padStart(2, "0")}` };
  },
  query_mute_audio: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 7) return null;
    return { label: "음소거", value: b[5] === 0x01 ? "켜짐" : "꺼짐" };
  },
};

// ---------- Hitachi Binary (BE EF 03 06 <crc> CMD GET reply) ----------

const hitachi: BrandDecoder = {
  query_power_state: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 1) return null;
    // Hitachi GET reply: 1D + 2-byte little-endian data, then CRC.
    // For power: 0001 = on, 0002 = standby.
    if (b[0] === 0x1d && b.length >= 3) {
      const v = b[1] | (b[2] << 8);
      return { label: "전원", value: v === 1 ? "켜짐" : v === 2 ? "대기" : `상태 ${v}` };
    }
    return null;
  },
  query_input_source: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 3 || b[0] !== 0x1d) return null;
    const v = b[1] | (b[2] << 8);
    const map: Record<number, string> = {
      0: "RGB 1",
      1: "RGB 2",
      2: "Component",
      3: "S-Video",
      4: "Video",
      5: "USB",
      6: "Network",
      7: "HDMI",
    };
    return { label: "입력", value: map[v] ?? `0x${v.toString(16)}` };
  },
  query_lamp_hours: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 3 || b[0] !== 0x1d) return null;
    const v = b[1] | (b[2] << 8);
    return { label: "램프 사용시간", value: String(v), unit: "시간" };
  },
  query_filter_hours: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 3 || b[0] !== 0x1d) return null;
    const v = b[1] | (b[2] << 8);
    return { label: "필터 사용시간", value: String(v), unit: "시간" };
  },
  query_error_status: (hex) => {
    const b = hexToBytes(hex);
    if (b.length < 3 || b[0] !== 0x1d) return null;
    const v = b[1] | (b[2] << 8);
    return { label: "에러", value: v === 0 ? "정상" : `에러 ${v}` };
  },
};

// ---------- Registry ----------

const BRAND_DECODERS: Record<string, BrandDecoder> = {
  benq: benq,
  epson: epson,
  optoma: optoma,
  christie: christie,
  infocus: infocus,
  panasonic: panasonic,
  sharp: sharp,
  nec: nec,
  hitachi: hitachi,
};

// Heuristic: derive a brand key from the equipment's manufacturer string or
// preset name. We're permissive ("BenQ" / "benq" / "Benq Corp" all match
// "benq") because brand spelling varies across CSVs/manuals.
export function brandKey(input: string | undefined | null): string | null {
  if (!input) return null;
  const lc = input.toLowerCase();
  for (const k of Object.keys(BRAND_DECODERS)) {
    if (lc.includes(k)) return k;
  }
  return null;
}

/**
 * Decode an RS232 response into a {label, value} pair the UI can render.
 *
 * - `brand`     equipment.manufacturer or preset brand string
 * - `command`   function name (e.g. "query_power_state")
 * - `hex`       firmware-returned response hex string (e.g. "2A504F573D4F4E23")
 *
 * Returns null when:
 *   - brand isn't in our decoder registry
 *   - we don't know this command for that brand
 *   - the response doesn't match the expected shape
 *
 * Callers should fall back to the raw hex/ASCII view on null.
 */
export function decodeRs232Response(
  brand: string | undefined | null,
  command: string,
  hex: string,
): DecodedField | null {
  const key = brandKey(brand);
  if (!key) return null;
  const dec = BRAND_DECODERS[key]?.[command];
  if (!dec) return null;
  try {
    return dec(hex);
  } catch {
    return null;
  }
}
