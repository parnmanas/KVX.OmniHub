import type {
  EquipmentCapability,
  FunctionRef,
  PresetCapabilitySpec,
} from "@omnihub/shared";
import { EquipmentFunction } from "../../entities";

// ---------------------------------------------------------------------------
// Capability inference.
//
// Two paths produce the same `EquipmentCapability[]` shape:
//
//   1) inferFromFunctions(fns)
//      Pure heuristic over function names. Works on legacy IR equipments
//      that have no preset metadata. Recognized name conventions:
//        power_on | power_off | power | power_toggle | query_power_state
//        source_<name> | input_<name> | query_input_source
//        mode_<name>   | query_mode
//        temp_<NN>     | query_temperature       (NUMERIC absolute)
//        vol_up | vol_down | query_volume        (COUNTER)
//        ch_up  | ch_down  | query_channel       (COUNTER)
//        fan_<low|med|high|auto> | fan_speed
//        swing | swing_v | swing_h
//        mute  | mute_on | mute_off  | query_mute_audio
//        freeze | blank | menu | up | down | left | right
//        query_lamp_hours | query_filter_hours | query_lamp_state
//        query_model_name | query_serial_number | query_firmware_version
//        query_error_status | query_aspect_ratio | query_brightness
//        query_contrast | query_temperature_internal
//
//   2) materializeFromSpec(specs, fns)
//      Resolves a preset's declared `capabilities[]` (which references
//      functions by name) into the runtime shape with FunctionRefs. Used
//      when a preset author wants to override grouping or add labels.
//
// The wider service merges both: spec-declared takes priority, anything
// inferable that the spec didn't claim gets appended.
// ---------------------------------------------------------------------------

type FnMap = Map<string, EquipmentFunction>;

function makeRef(fn: EquipmentFunction): FunctionRef {
  return { id: fn.id, name: fn.name };
}

function buildMap(fns: EquipmentFunction[]): FnMap {
  return new Map(fns.map((f) => [f.name, f]));
}

// Pretty-print an IR/RS232 function name like "source_hdmi_1" → "HDMI 1".
function humanize(suffix: string): string {
  return suffix
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const SOURCE_LABELS: Record<string, string> = {
  hdmi1: "HDMI 1",
  hdmi2: "HDMI 2",
  hdmi3: "HDMI 3",
  vga: "VGA",
  vga1: "VGA 1",
  vga2: "VGA 2",
  component: "Component",
  composite: "Composite",
  video: "Video",
  svideo: "S-Video",
  s_video: "S-Video",
  dvi: "DVI",
  displayport: "DisplayPort",
  usb: "USB",
  network: "Network",
  bnc: "BNC",
};

const MODE_LABELS: Record<string, string> = {
  cool: "냉방",
  heat: "난방",
  dry: "제습",
  fan: "송풍",
  auto: "자동",
  eco: "절전",
  presentation: "프리젠테이션",
  movie: "영화",
  vivid: "선명",
  standard: "표준",
  sport: "스포츠",
  game: "게임",
};

const FAN_LABELS: Record<string, string> = {
  auto: "자동",
  low: "약",
  med: "중",
  medium: "중",
  high: "강",
  highest: "최강",
  lowest: "최약",
};

// ---------- TOGGLE ----------

function inferToggle(
  key: string,
  label: string,
  fns: FnMap,
  onNames: string[],
  offNames: string[],
  toggleNames: string[],
  getNames: string[],
): EquipmentCapability | null {
  const on = onNames.map((n) => fns.get(n)).find(Boolean) ?? null;
  const off = offNames.map((n) => fns.get(n)).find(Boolean) ?? null;
  const tog = toggleNames.map((n) => fns.get(n)).find(Boolean) ?? null;
  const get = getNames.map((n) => fns.get(n)).find(Boolean) ?? null;
  if (!on && !off && !tog && !get) return null;
  return {
    kind: "toggle",
    key,
    label,
    on: on ? makeRef(on) : null,
    off: off ? makeRef(off) : null,
    toggle: tog ? makeRef(tog) : null,
    get: get ? makeRef(get) : null,
  };
}

// ---------- ENUM ----------

function inferEnum(
  key: string,
  label: string,
  fns: EquipmentFunction[],
  prefix: string,
  labelMap: Record<string, string>,
  getName: string | null,
): EquipmentCapability | null {
  const opts = fns
    .filter((f) => f.name.startsWith(prefix))
    .map((f) => {
      const tail = f.name.slice(prefix.length);
      return {
        value: tail,
        label: labelMap[tail] ?? humanize(tail),
        set: makeRef(f),
      };
    });
  if (opts.length === 0) return null;
  const fnMap = buildMap(fns);
  const get = (getName && fnMap.get(getName)) || null;
  return {
    kind: "enum",
    key,
    label,
    options: opts,
    get: get ? makeRef(get) : null,
  };
}

// ---------- NUMERIC ----------

function inferTemperature(
  fns: EquipmentFunction[],
): EquipmentCapability | null {
  const setters = fns
    .map((f) => {
      const m = f.name.match(/^temp_(\d+)$/);
      return m ? { value: parseInt(m[1], 10), set: makeRef(f) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.value - b.value);
  if (setters.length === 0) return null;
  const fnMap = buildMap(fns);
  const get = fnMap.get("query_temperature") ?? null;
  return {
    kind: "numeric",
    key: "temperature",
    label: "온도",
    unit: "°C",
    min: setters[0].value,
    max: setters[setters.length - 1].value,
    setters,
    get: get ? makeRef(get) : null,
  };
}

// ---------- COUNTER ----------

function inferCounter(
  key: string,
  label: string,
  fns: FnMap,
  incNames: string[],
  decNames: string[],
  getNames: string[],
  unit?: string,
): EquipmentCapability | null {
  const inc = incNames.map((n) => fns.get(n)).find(Boolean) ?? null;
  const dec = decNames.map((n) => fns.get(n)).find(Boolean) ?? null;
  const get = getNames.map((n) => fns.get(n)).find(Boolean) ?? null;
  if (!inc && !dec && !get) return null;
  return {
    kind: "counter",
    key,
    label,
    unit,
    increment: inc ? makeRef(inc) : null,
    decrement: dec ? makeRef(dec) : null,
    get: get ? makeRef(get) : null,
  };
}

// ---------- READONLY ----------

const READONLY_FNS: { name: string; key: string; label: string; unit?: string }[] = [
  { name: "query_lamp_hours", key: "lamp_hours", label: "램프 사용시간", unit: "시간" },
  { name: "query_filter_hours", key: "filter_hours", label: "필터 사용시간", unit: "시간" },
  { name: "query_lamp_state", key: "lamp_state", label: "램프 상태" },
  { name: "query_model_name", key: "model_name", label: "모델" },
  { name: "query_serial_number", key: "serial_number", label: "S/N" },
  { name: "query_firmware_version", key: "firmware_version", label: "펌웨어" },
  { name: "query_error_status", key: "error_status", label: "에러 상태" },
  { name: "query_temperature_internal", key: "temperature_internal", label: "내부 온도", unit: "°C" },
  { name: "query_brightness", key: "brightness", label: "밝기" },
  { name: "query_contrast", key: "contrast", label: "대비" },
  { name: "query_aspect_ratio", key: "aspect_ratio", label: "화면비" },
];

function inferReadonly(fns: FnMap): EquipmentCapability[] {
  const out: EquipmentCapability[] = [];
  for (const def of READONLY_FNS) {
    const fn = fns.get(def.name);
    if (!fn) continue;
    out.push({
      kind: "readonly",
      key: def.key,
      label: def.label,
      unit: def.unit,
      get: makeRef(fn),
    });
  }
  return out;
}

// ---------- TRIGGER ----------

const TRIGGER_FNS: { name: string; key: string; label: string }[] = [
  { name: "menu", key: "menu", label: "메뉴" },
  { name: "home", key: "home", label: "홈" },
  { name: "back", key: "back", label: "뒤로" },
  { name: "exit", key: "exit", label: "종료" },
  { name: "ok", key: "ok", label: "확인" },
  { name: "enter", key: "enter", label: "확인" },
  { name: "up", key: "nav_up", label: "↑" },
  { name: "down", key: "nav_down", label: "↓" },
  { name: "left", key: "nav_left", label: "←" },
  { name: "right", key: "nav_right", label: "→" },
  { name: "freeze", key: "freeze", label: "정지" },
  { name: "blank", key: "blank", label: "화면 끄기" },
  { name: "auto", key: "auto_adjust", label: "자동 조정" },
  { name: "info", key: "info", label: "정보" },
  { name: "input", key: "input_cycle", label: "입력 전환" },
  { name: "jet_cool", key: "jet_cool", label: "급속냉방" },
  { name: "swing", key: "swing", label: "스윙" },
  { name: "swing_v", key: "swing_v", label: "세로 스윙" },
  { name: "swing_h", key: "swing_h", label: "가로 스윙" },
  { name: "sleep", key: "sleep", label: "수면 모드" },
  { name: "timer", key: "timer", label: "타이머" },
  { name: "light", key: "light", label: "조명" },
  { name: "light_toggle", key: "light_toggle", label: "조명 토글" },
];

function inferTriggers(fns: FnMap, claimed: Set<string>): EquipmentCapability[] {
  const out: EquipmentCapability[] = [];
  for (const def of TRIGGER_FNS) {
    if (claimed.has(def.name)) continue;
    const fn = fns.get(def.name);
    if (!fn) continue;
    out.push({
      kind: "trigger",
      key: def.key,
      label: def.label,
      fire: makeRef(fn),
    });
  }
  return out;
}

// ---------- main inference ----------

export function inferCapabilities(
  functions: EquipmentFunction[],
): EquipmentCapability[] {
  const fnMap = buildMap(functions);
  const caps: EquipmentCapability[] = [];
  // Track function names already represented by a capability so the
  // catch-all TRIGGER pass doesn't double-up.
  const claimed = new Set<string>();

  const claim = (cap: EquipmentCapability | null): EquipmentCapability | null => {
    if (!cap) return null;
    visitRefs(cap, (ref) => claimed.add(ref.name));
    caps.push(cap);
    return cap;
  };

  // TOGGLE — power, mute, freeze, blank.
  claim(
    inferToggle(
      "power",
      "전원",
      fnMap,
      ["power_on"],
      ["power_off"],
      ["power", "power_toggle"],
      ["query_power_state"],
    ),
  );
  claim(
    inferToggle(
      "mute_audio",
      "음소거",
      fnMap,
      ["mute_on", "mute_audio_on"],
      ["mute_off", "mute_audio_off"],
      ["mute", "mute_audio"],
      ["query_mute_audio"],
    ),
  );
  claim(
    inferToggle(
      "mute_video",
      "영상 차단",
      fnMap,
      ["mute_video_on", "blank_on"],
      ["mute_video_off", "blank_off"],
      ["blank", "mute_video"],
      ["query_mute_video"],
    ),
  );

  // ENUM — input, mode, fan_speed, aspect.
  claim(
    inferEnum(
      "input",
      "입력",
      functions,
      "source_",
      SOURCE_LABELS,
      "query_input_source",
    ),
  );
  // Some remotes prefix inputs with "input_" instead of "source_".
  if (!caps.find((c) => c.key === "input")) {
    claim(
      inferEnum(
        "input",
        "입력",
        functions,
        "input_",
        SOURCE_LABELS,
        "query_input_source",
      ),
    );
  }
  claim(
    inferEnum("mode", "모드", functions, "mode_", MODE_LABELS, "query_mode"),
  );
  claim(
    inferEnum(
      "fan_speed",
      "풍속",
      functions,
      "fan_",
      FAN_LABELS,
      "query_fan_speed",
    ),
  );
  claim(
    inferEnum("aspect", "화면비", functions, "aspect_", {}, "query_aspect_ratio"),
  );

  // NUMERIC — temperature.
  claim(inferTemperature(functions));

  // COUNTER — volume, channel.
  claim(
    inferCounter(
      "volume",
      "볼륨",
      fnMap,
      ["vol_up", "volume_up"],
      ["vol_down", "volume_down"],
      ["query_volume"],
    ),
  );
  claim(
    inferCounter(
      "channel",
      "채널",
      fnMap,
      ["ch_up", "channel_up"],
      ["ch_down", "channel_down"],
      ["query_channel"],
    ),
  );
  claim(
    inferCounter(
      "temperature_rel",
      "온도 (상대)",
      fnMap,
      ["temp_up"],
      ["temp_down"],
      [],
      "°C",
    ),
  );
  // Drop the redundant relative-temperature capability if absolute is also
  // present — they'd render two near-identical widgets.
  const absoluteTemp = caps.some(
    (c) => c.kind === "numeric" && c.key === "temperature",
  );
  if (absoluteTemp) {
    const idx = caps.findIndex((c) => c.key === "temperature_rel");
    if (idx >= 0) caps.splice(idx, 1);
  }
  claim(
    inferCounter(
      "brightness_rel",
      "밝기 (상대)",
      fnMap,
      ["brightness_up"],
      ["brightness_down"],
      [],
    ),
  );
  claim(
    inferCounter(
      "contrast_rel",
      "대비 (상대)",
      fnMap,
      ["contrast_up"],
      ["contrast_down"],
      [],
    ),
  );

  // READONLY — query_* statuses with no setter pair.
  for (const ro of inferReadonly(fnMap)) {
    // Skip readonlies whose getter is already claimed by a TOGGLE/ENUM/NUMERIC.
    if (ro.kind === "readonly" && claimed.has(ro.get.name)) continue;
    claim(ro);
  }

  // TRIGGER — remaining one-shot buttons (menu, navigation, freeze, …).
  for (const t of inferTriggers(fnMap, claimed)) {
    claim(t);
  }

  return caps;
}

function visitRefs(
  cap: EquipmentCapability,
  visit: (r: FunctionRef) => void,
): void {
  switch (cap.kind) {
    case "toggle":
      [cap.on, cap.off, cap.toggle, cap.get].forEach((r) => r && visit(r));
      break;
    case "enum":
      cap.options.forEach((o) => visit(o.set));
      if (cap.get) visit(cap.get);
      break;
    case "numeric":
      cap.setters.forEach((s) => visit(s.set));
      if (cap.get) visit(cap.get);
      break;
    case "counter":
      [cap.increment, cap.decrement, cap.get].forEach((r) => r && visit(r));
      break;
    case "readonly":
      visit(cap.get);
      break;
    case "trigger":
      visit(cap.fire);
      break;
  }
}

// ---------- materialize preset-declared spec ----------

export function materializeCapabilitySpec(
  spec: PresetCapabilitySpec,
  functions: EquipmentFunction[],
): EquipmentCapability | null {
  const byName = buildMap(functions);
  const need = (name: string | undefined): FunctionRef | null => {
    if (!name) return null;
    const f = byName.get(name);
    return f ? makeRef(f) : null;
  };
  const label = spec.label ?? spec.key;
  switch (spec.kind) {
    case "toggle":
      return {
        kind: "toggle",
        key: spec.key,
        label,
        on: need(spec.on),
        off: need(spec.off),
        toggle: need(spec.toggle),
        get: need(spec.get),
      };
    case "enum": {
      const options = spec.options
        .map((o) => {
          const set = need(o.set);
          if (!set) return null;
          return {
            value: o.value,
            label: o.label ?? humanize(o.value),
            set,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (options.length === 0) return null;
      return {
        kind: "enum",
        key: spec.key,
        label,
        options,
        get: need(spec.get),
      };
    }
    case "numeric": {
      const setters = spec.setters
        .map((s) => {
          const set = need(s.set);
          return set ? { value: s.value, set } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.value - b.value);
      if (setters.length === 0) return null;
      return {
        kind: "numeric",
        key: spec.key,
        label,
        unit: spec.unit,
        min: spec.min ?? setters[0].value,
        max: spec.max ?? setters[setters.length - 1].value,
        setters,
        get: need(spec.get),
      };
    }
    case "counter": {
      const inc = need(spec.increment);
      const dec = need(spec.decrement);
      const get = need(spec.get);
      if (!inc && !dec && !get) return null;
      return {
        kind: "counter",
        key: spec.key,
        label,
        unit: spec.unit,
        increment: inc,
        decrement: dec,
        get,
      };
    }
    case "readonly": {
      const get = need(spec.get);
      if (!get) return null;
      return {
        kind: "readonly",
        key: spec.key,
        label,
        unit: spec.unit,
        get,
      };
    }
    case "trigger": {
      const fire = need(spec.fire);
      if (!fire) return null;
      return { kind: "trigger", key: spec.key, label, fire };
    }
  }
}
