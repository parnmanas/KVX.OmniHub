import { useCallback, useEffect, useState } from "react";
import type {
  CounterCapability,
  EnumCapability,
  EquipmentCapability,
  NumericCapability,
  ReadonlyCapability,
  ToggleCapability,
  TriggerCapability,
} from "@omnihub/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePlayEquipmentFunction } from "@/features/equipments/use-equipment-functions";
import { decodeRs232Response } from "@/features/rs232/decoders";

interface Props {
  brand: string;
  capabilities: EquipmentCapability[];
  canControl: boolean;
  // Whether to auto-poll all readonly + state queries on a timer.
  autoRefreshMs: number;
  onAutoRefreshChange: (ms: number) => void;
}

const AUTO_REFRESH_OPTIONS: { label: string; ms: number }[] = [
  { label: "수동", ms: 0 },
  { label: "10초", ms: 10_000 },
  { label: "30초", ms: 30_000 },
  { label: "1분", ms: 60_000 },
  { label: "5분", ms: 300_000 },
];

/**
 * Unified equipment control panel.
 *
 * Renders one widget per capability, grouped by kind:
 *   - TOGGLE       → power-style on/off control
 *   - ENUM         → input source selector
 *   - NUMERIC      → temperature stepper
 *   - COUNTER      → volume +/- buttons
 *   - READONLY     → lamp hours readout
 *   - TRIGGER      → menu / freeze / navigation buttons
 *
 * Same UI regardless of underlying protocol — an IR projector with
 * `power_on`/`power_off` and an RS232 projector with `power_on`/
 * `power_off`/`query_power_state` both render as a "Power" toggle. The
 * RS232 version additionally lights up the "current state" indicator
 * because it has a getter.
 *
 * Per-capability state (lastQueriedValue, lastQueriedAt) lives in this
 * component. RS232 replies aren't a server resource — they're snapshots
 * the device hands back per query.
 */
export function CapabilityPanel({
  brand,
  capabilities,
  canControl,
  autoRefreshMs,
  onAutoRefreshChange,
}: Props) {
  const playMutation = usePlayEquipmentFunction();
  // Map from "capabilityKey" → decoded display value (for toggle/enum/readonly).
  // Counter doesn't cache because the value is a moving target (every +/-
  // press changes it on the device); the user re-queries explicitly.
  const [values, setValues] = useState<Map<string, ValueState>>(new Map());

  const runQuery = useCallback(
    async (key: string, getFnId: string, getFnName: string) => {
      try {
        const out = await playMutation.mutateAsync(getFnId);
        const decoded = out.response
          ? decodeRs232Response(brand, getFnName, out.response)
          : null;
        setValues((prev) => {
          const next = new Map(prev);
          next.set(key, {
            decoded,
            rawHex: out.response ?? "",
            at: Date.now(),
          });
          return next;
        });
      } catch (err) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ??
          (err as Error).message ??
          "실패";
        setValues((prev) => {
          const next = new Map(prev);
          next.set(key, {
            decoded: null,
            rawHex: "",
            at: Date.now(),
            error: msg,
          });
          return next;
        });
      }
    },
    [brand, playMutation],
  );

  const refreshAll = useCallback(async () => {
    if (!canControl) return;
    for (const cap of capabilities) {
      const getter = getterRef(cap);
      if (!getter) continue;
      // Serial — RS232 bus can't handle concurrent commands.
      // eslint-disable-next-line no-await-in-loop
      await runQuery(cap.key, getter.id, getter.name);
    }
  }, [canControl, capabilities, runQuery]);

  useEffect(() => {
    if (autoRefreshMs <= 0) return;
    const id = setInterval(() => {
      void refreshAll();
    }, autoRefreshMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshMs, capabilities.length, canControl]);

  if (capabilities.length === 0) return null;

  // Group by kind for layout. Controls first (you act on them), readonly
  // metrics next (you observe them), triggers last (one-shot actions).
  const groups: { title: string; items: EquipmentCapability[] }[] = [
    {
      title: "제어",
      items: capabilities.filter((c) =>
        ["toggle", "enum", "numeric", "counter"].includes(c.kind),
      ),
    },
    {
      title: "상태",
      items: capabilities.filter((c) => c.kind === "readonly"),
    },
    {
      title: "동작",
      items: capabilities.filter((c) => c.kind === "trigger"),
    },
  ];

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">제어판</h2>
          <p className="text-xs text-muted-foreground">
            장비의 모든 기능을 통일된 형태로 조작합니다.
            {anyHasGetter(capabilities)
              ? " 상태 조회가 있는 항목은 현재 값을 보여주거나 자동 갱신할 수 있어요."
              : ""}
          </p>
        </div>
        {anyHasGetter(capabilities) && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">자동 갱신</label>
            <select
              value={autoRefreshMs}
              onChange={(e) =>
                onAutoRefreshChange(parseInt(e.target.value, 10))
              }
              className="rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {AUTO_REFRESH_OPTIONS.map((o) => (
                <option key={o.ms} value={o.ms}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!canControl || playMutation.isPending}
              onClick={() => void refreshAll()}
            >
              모두 새로고침
            </Button>
          </div>
        )}
      </div>

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.title} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {g.title}
            </h3>
            <div
              className={
                g.title === "동작"
                  ? "flex flex-wrap gap-2"
                  : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {g.items.map((cap) => (
                <CapabilityWidget
                  key={cap.key}
                  cap={cap}
                  state={values.get(cap.key)}
                  canControl={canControl}
                  onSet={(fnId) => void playMutation.mutateAsync(fnId)}
                  onQuery={(fnId, fnName) => void runQuery(cap.key, fnId, fnName)}
                />
              ))}
            </div>
          </div>
        ))}
    </Card>
  );
}

interface ValueState {
  decoded: { label: string; value: string; unit?: string } | null;
  rawHex: string;
  at: number;
  error?: string;
}

function CapabilityWidget({
  cap,
  state,
  canControl,
  onSet,
  onQuery,
}: {
  cap: EquipmentCapability;
  state: ValueState | undefined;
  canControl: boolean;
  onSet: (fnId: string) => void;
  onQuery: (fnId: string, fnName: string) => void;
}) {
  switch (cap.kind) {
    case "toggle":
      return (
        <TogglePill
          cap={cap}
          state={state}
          canControl={canControl}
          onSet={onSet}
          onQuery={onQuery}
        />
      );
    case "enum":
      return (
        <EnumPill
          cap={cap}
          state={state}
          canControl={canControl}
          onSet={onSet}
          onQuery={onQuery}
        />
      );
    case "numeric":
      return (
        <NumericPill
          cap={cap}
          state={state}
          canControl={canControl}
          onSet={onSet}
          onQuery={onQuery}
        />
      );
    case "counter":
      return (
        <CounterPill
          cap={cap}
          state={state}
          canControl={canControl}
          onSet={onSet}
          onQuery={onQuery}
        />
      );
    case "readonly":
      return (
        <ReadonlyPill
          cap={cap}
          state={state}
          canControl={canControl}
          onQuery={onQuery}
        />
      );
    case "trigger":
      return (
        <TriggerButton cap={cap} canControl={canControl} onSet={onSet} />
      );
  }
}

// ---------- widgets ----------

function pillCard(children: React.ReactNode) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
      {children}
    </div>
  );
}

function valueLine(label: string, state: ValueState | undefined) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs">
        {state?.error ? (
          <span className="text-destructive" title={state.error}>
            오류
          </span>
        ) : state?.decoded ? (
          <span className="font-medium">
            {state.decoded.value}
            {state.decoded.unit ? (
              <span className="ml-1 text-muted-foreground">
                {state.decoded.unit}
              </span>
            ) : null}
          </span>
        ) : state ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {state.rawHex.slice(0, 20) || "(빈 응답)"}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  );
}

function TogglePill({
  cap,
  state,
  canControl,
  onSet,
  onQuery,
}: {
  cap: ToggleCapability;
  state: ValueState | undefined;
  canControl: boolean;
  onSet: (fnId: string) => void;
  onQuery: (fnId: string, fnName: string) => void;
}) {
  return pillCard(
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{cap.label}</span>
        {cap.get && (
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline disabled:opacity-50"
            disabled={!canControl}
            onClick={() => onQuery(cap.get!.id, cap.get!.name)}
          >
            조회
          </button>
        )}
      </div>
      {cap.get && valueLine("현재", state)}
      <div className="flex gap-2">
        {cap.on && (
          <Button
            size="sm"
            disabled={!canControl}
            onClick={() => onSet(cap.on!.id)}
          >
            켜기
          </Button>
        )}
        {cap.off && (
          <Button
            size="sm"
            variant="outline"
            disabled={!canControl}
            onClick={() => onSet(cap.off!.id)}
          >
            끄기
          </Button>
        )}
        {cap.toggle && (
          <Button
            size="sm"
            variant={cap.on || cap.off ? "outline" : "default"}
            disabled={!canControl}
            onClick={() => onSet(cap.toggle!.id)}
            title="현재 상태를 반대로 전환"
          >
            토글
          </Button>
        )}
      </div>
    </div>,
  );
}

function EnumPill({
  cap,
  state,
  canControl,
  onSet,
  onQuery,
}: {
  cap: EnumCapability;
  state: ValueState | undefined;
  canControl: boolean;
  onSet: (fnId: string) => void;
  onQuery: (fnId: string, fnName: string) => void;
}) {
  return pillCard(
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{cap.label}</span>
        {cap.get && (
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline disabled:opacity-50"
            disabled={!canControl}
            onClick={() => onQuery(cap.get!.id, cap.get!.name)}
          >
            조회
          </button>
        )}
      </div>
      {cap.get && valueLine("현재", state)}
      <select
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
        disabled={!canControl}
        defaultValue=""
        onChange={(e) => {
          const opt = cap.options.find((o) => o.value === e.target.value);
          if (opt) onSet(opt.set.id);
          e.target.value = "";
        }}
      >
        <option value="" disabled>
          전환할 값 선택…
        </option>
        {cap.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>,
  );
}

function NumericPill({
  cap,
  state,
  canControl,
  onSet,
  onQuery,
}: {
  cap: NumericCapability;
  state: ValueState | undefined;
  canControl: boolean;
  onSet: (fnId: string) => void;
  onQuery: (fnId: string, fnName: string) => void;
}) {
  return pillCard(
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {cap.label}
          {cap.unit ? (
            <span className="ml-1 text-xs text-muted-foreground">
              ({cap.unit})
            </span>
          ) : null}
        </span>
        {cap.get && (
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline disabled:opacity-50"
            disabled={!canControl}
            onClick={() => onQuery(cap.get!.id, cap.get!.name)}
          >
            조회
          </button>
        )}
      </div>
      {cap.get && valueLine("현재", state)}
      <select
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
        disabled={!canControl}
        defaultValue=""
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          const s = cap.setters.find((x) => x.value === v);
          if (s) onSet(s.set.id);
          e.target.value = "";
        }}
      >
        <option value="" disabled>
          설정할 값 선택…
        </option>
        {cap.setters.map((s) => (
          <option key={s.value} value={s.value}>
            {s.value}
            {cap.unit ?? ""}
          </option>
        ))}
      </select>
    </div>,
  );
}

function CounterPill({
  cap,
  state,
  canControl,
  onSet,
  onQuery,
}: {
  cap: CounterCapability;
  state: ValueState | undefined;
  canControl: boolean;
  onSet: (fnId: string) => void;
  onQuery: (fnId: string, fnName: string) => void;
}) {
  return pillCard(
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{cap.label}</span>
        {cap.get && (
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline disabled:opacity-50"
            disabled={!canControl}
            onClick={() => onQuery(cap.get!.id, cap.get!.name)}
          >
            조회
          </button>
        )}
      </div>
      {cap.get && valueLine("현재", state)}
      <div className="flex gap-2">
        {cap.decrement && (
          <Button
            size="sm"
            variant="outline"
            disabled={!canControl}
            onClick={() => onSet(cap.decrement!.id)}
          >
            −
          </Button>
        )}
        {cap.increment && (
          <Button
            size="sm"
            variant="outline"
            disabled={!canControl}
            onClick={() => onSet(cap.increment!.id)}
          >
            +
          </Button>
        )}
      </div>
    </div>,
  );
}

function ReadonlyPill({
  cap,
  state,
  canControl,
  onQuery,
}: {
  cap: ReadonlyCapability;
  state: ValueState | undefined;
  canControl: boolean;
  onQuery: (fnId: string, fnName: string) => void;
}) {
  return pillCard(
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{cap.label}</span>
        <button
          type="button"
          className="text-[10px] text-muted-foreground underline disabled:opacity-50"
          disabled={!canControl}
          onClick={() => onQuery(cap.get.id, cap.get.name)}
        >
          조회
        </button>
      </div>
      <div className="font-semibold">
        {state?.error ? (
          <span className="text-destructive" title={state.error}>
            오류
          </span>
        ) : state?.decoded ? (
          <>
            {state.decoded.value}
            {state.decoded.unit || cap.unit ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {state.decoded.unit ?? cap.unit}
              </span>
            ) : null}
          </>
        ) : state ? (
          <span className="font-mono text-xs text-muted-foreground">
            {state.rawHex.slice(0, 20) || "(빈 응답)"}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      {state && (
        <p className="text-[10px] text-muted-foreground">
          {formatRelativeTime(state.at)}
        </p>
      )}
    </div>,
  );
}

function TriggerButton({
  cap,
  canControl,
  onSet,
}: {
  cap: TriggerCapability;
  canControl: boolean;
  onSet: (fnId: string) => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!canControl}
      onClick={() => onSet(cap.fire.id)}
    >
      {cap.label}
    </Button>
  );
}

// ---------- helpers ----------

function getterRef(
  cap: EquipmentCapability,
): { id: string; name: string } | null {
  switch (cap.kind) {
    case "readonly":
      return cap.get;
    case "toggle":
    case "enum":
    case "numeric":
    case "counter":
      return cap.get;
    default:
      return null;
  }
}

function anyHasGetter(caps: EquipmentCapability[]): boolean {
  return caps.some((c) => getterRef(c) !== null);
}

function formatRelativeTime(t: number): string {
  const diff = Date.now() - t;
  if (diff < 5_000) return "방금 전";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}초 전`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  return new Date(t).toLocaleTimeString();
}
