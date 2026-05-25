// Capabilities — high-level controls grouped from raw EquipmentFunctions.
//
// Why this exists: raw functions are too low-level for users. A projector
// might expose `power_on`, `power_off`, and `query_power_state` as three
// separate IR/RS232 functions, but the operator's mental model is "this
// device has a 'power' switch". A capability groups those three rows into
// one toggle widget. Same logic applies to:
//
//   - input source         (source_hdmi1 / source_hdmi2 / source_vga …)
//   - operating mode       (mode_cool / mode_heat / mode_dry …)
//   - temperature          (temp_16 / temp_17 / … / temp_30)
//   - relative volume      (vol_up / vol_down, plus optional query_volume)
//   - lamp hours readout   (query_lamp_hours, no setter)
//
// Capabilities are derived, not stored: the server infers them from the
// equipment's function list (using both preset-declared mappings and
// name-prefix heuristics) and returns them alongside Equipment. The UI
// renders a capability widget per kind; the underlying function id is
// still what gets dispatched when the user clicks. This keeps the
// IR/RS232/WOL/HTTP/RELAY dispatch path unchanged — capabilities are pure
// presentation layer.

export const CapabilityKind = {
  // Two-state on/off. Common across power, mute, freeze, blank, …
  // Implementations vary:
  //   - separate on/off setters       (RS232: power_on + power_off)
  //   - single toggle setter          (IR remote with one 'power' button)
  //   - getter-only (RS232 query)     (when you only have a status query)
  TOGGLE: "toggle",
  // Pick one from a list of named values (input source, AC mode, aspect).
  ENUM: "enum",
  // Set an absolute numeric value (AC temperature 16..30°C).
  NUMERIC: "numeric",
  // Relative +/- adjustment (volume up/down, channel up/down). The actual
  // value is unknown unless a getter is also wired up.
  COUNTER: "counter",
  // Read-only status (lamp hours, firmware version, error code).
  READONLY: "readonly",
  // One-shot fire-and-forget action (menu, freeze, auto-adjust, info).
  TRIGGER: "trigger",
} as const;
export type CapabilityKind =
  (typeof CapabilityKind)[keyof typeof CapabilityKind];

// Common metadata. `key` is a stable identifier (e.g. "power"), `label`
// is the human-readable text (e.g. "전원"), `controlType` mirrors the
// underlying functions so the UI can render the right hint badges.
export interface CapabilityBase {
  key: string;
  label: string;
  kind: CapabilityKind;
}

// Reference to a single function. We carry the function name in addition
// to the id so the UI can render rich descriptions without an extra fetch.
export interface FunctionRef {
  id: string;
  name: string;
}

export interface ToggleCapability extends CapabilityBase {
  kind: "toggle";
  // Any of these may be null. At minimum one must be present, else the
  // capability shouldn't have been emitted.
  on: FunctionRef | null; // explicit "set on" setter
  off: FunctionRef | null; // explicit "set off" setter
  toggle: FunctionRef | null; // single-press toggle (IR remotes)
  // Getter is optional — IR-only toggles can't be queried. Server-side
  // RS232 toggles usually have one (query_power_state etc).
  get: FunctionRef | null;
}

export interface EnumOption {
  value: string; // e.g. "hdmi1"
  label: string; // e.g. "HDMI 1"
  set: FunctionRef;
}

export interface EnumCapability extends CapabilityBase {
  kind: "enum";
  options: EnumOption[];
  get: FunctionRef | null;
}

export interface NumericSetter {
  value: number;
  set: FunctionRef;
}

export interface NumericCapability extends CapabilityBase {
  kind: "numeric";
  unit?: string; // "°C", "%", "단계"
  min?: number;
  max?: number;
  // Discrete preset values when the device only accepts specific targets
  // (LG AC: temp_16 .. temp_30). Empty when the device only supports
  // relative adjustment — in that case use COUNTER instead.
  setters: NumericSetter[];
  get: FunctionRef | null;
}

export interface CounterCapability extends CapabilityBase {
  kind: "counter";
  // Optional getter for the current value (volume often has one).
  get: FunctionRef | null;
  increment: FunctionRef | null;
  decrement: FunctionRef | null;
  unit?: string;
}

export interface ReadonlyCapability extends CapabilityBase {
  kind: "readonly";
  get: FunctionRef;
  unit?: string;
}

export interface TriggerCapability extends CapabilityBase {
  kind: "trigger";
  fire: FunctionRef;
}

export type EquipmentCapability =
  | ToggleCapability
  | EnumCapability
  | NumericCapability
  | CounterCapability
  | ReadonlyCapability
  | TriggerCapability;

// ---------------------------------------------------------------------------
// Preset-declared capability spec.
//
// A preset author can override the inferred grouping by listing capabilities
// up front. Each entry refers to commands by NAME (not id, since ids only
// exist after instantiation). The server resolves names → function refs
// when materializing the equipment.
// ---------------------------------------------------------------------------

interface PresetToggleSpec {
  key: string;
  label?: string;
  kind: "toggle";
  on?: string;
  off?: string;
  toggle?: string;
  get?: string;
}

interface PresetEnumSpec {
  key: string;
  label?: string;
  kind: "enum";
  get?: string;
  options: { value: string; label?: string; set: string }[];
}

interface PresetNumericSpec {
  key: string;
  label?: string;
  kind: "numeric";
  unit?: string;
  min?: number;
  max?: number;
  get?: string;
  setters: { value: number; set: string }[];
}

interface PresetCounterSpec {
  key: string;
  label?: string;
  kind: "counter";
  unit?: string;
  get?: string;
  increment?: string;
  decrement?: string;
}

interface PresetReadonlySpec {
  key: string;
  label?: string;
  kind: "readonly";
  unit?: string;
  get: string;
}

interface PresetTriggerSpec {
  key: string;
  label?: string;
  kind: "trigger";
  fire: string;
}

export type PresetCapabilitySpec =
  | PresetToggleSpec
  | PresetEnumSpec
  | PresetNumericSpec
  | PresetCounterSpec
  | PresetReadonlySpec
  | PresetTriggerSpec;
