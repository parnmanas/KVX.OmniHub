import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePlayEquipmentFunction } from "@/features/equipments/use-equipment-functions";
import type { EquipmentFunction } from "@/features/equipments/types";
import { decodeRs232Response, type DecodedField } from "./decoders";

interface QueryResult {
  fnId: string;
  fnName: string;
  decoded: DecodedField | null; // null → couldn't structure, raw shown instead
  rawHex: string;
  at: number; // epoch ms
  error?: string;
}

interface Props {
  brand: string;
  functions: EquipmentFunction[];
  canControl: boolean;
  // Wall-clock ms between auto-polls; 0 disables. Persisted by the parent
  // page so the user's preference survives reloads.
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
 * "현재 상태" dashboard. Lists every RS232 function whose name starts with
 * `query_` and lets the operator refresh them all with one click. Each cell
 * shows the decoded label/value (e.g. "전원: 켜짐") plus the timestamp and
 * the raw bytes for verification.
 *
 * Caching strategy: results live in component state, not react-query.
 * RS232 replies are point-in-time snapshots — there's no canonical "list"
 * URL to invalidate. Local state is the cleanest mental model.
 */
export function Rs232StatusPanel({
  brand,
  functions,
  canControl,
  autoRefreshMs,
  onAutoRefreshChange,
}: Props) {
  const queryFns = functions.filter(
    (f) =>
      f.controlType === "RS232" &&
      typeof f.name === "string" &&
      f.name.startsWith("query_"),
  );
  const playMutation = usePlayEquipmentFunction();
  const [results, setResults] = useState<Map<string, QueryResult>>(
    () => new Map(),
  );
  const [refreshing, setRefreshing] = useState(false);

  const runAll = useCallback(async () => {
    if (refreshing || queryFns.length === 0 || !canControl) return;
    setRefreshing(true);
    // Serial loop — most projectors can only handle one in-flight RS232
    // command at a time, and the firmware reconfigures the UART per call.
    // Parallel would interleave the bus and confuse the projector.
    for (const fn of queryFns) {
      try {
        const out = await playMutation.mutateAsync(fn.id);
        const decoded = out.response
          ? decodeRs232Response(brand, fn.name, out.response)
          : null;
        setResults((prev) => {
          const next = new Map(prev);
          next.set(fn.id, {
            fnId: fn.id,
            fnName: fn.name,
            decoded,
            rawHex: out.response ?? "",
            at: Date.now(),
          });
          return next;
        });
      } catch (err) {
        const msg = (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ??
          (err as Error).message ??
          "실패";
        setResults((prev) => {
          const next = new Map(prev);
          next.set(fn.id, {
            fnId: fn.id,
            fnName: fn.name,
            decoded: null,
            rawHex: "",
            at: Date.now(),
            error: msg,
          });
          return next;
        });
      }
    }
    setRefreshing(false);
  }, [brand, canControl, playMutation, queryFns, refreshing]);

  // Auto-refresh ticker. We intentionally don't include `runAll` in the
  // deps because react-query's mutation identity changes per render and
  // would force a reschedule every tick.
  useEffect(() => {
    if (autoRefreshMs <= 0 || queryFns.length === 0) return;
    const id = setInterval(() => {
      void runAll();
    }, autoRefreshMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshMs, queryFns.length]);

  if (queryFns.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">현재 상태</h2>
          <p className="text-xs text-muted-foreground">
            장비에 query_ 기능을 호출해 실제 상태를 읽어옵니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">자동 갱신</label>
          <select
            value={autoRefreshMs}
            onChange={(e) => onAutoRefreshChange(parseInt(e.target.value, 10))}
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
            disabled={refreshing || !canControl}
            onClick={() => void runAll()}
            title={!canControl ? "OmniHub 미할당 또는 오프라인" : ""}
          >
            {refreshing ? "조회 중…" : "새로고침"}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {queryFns.map((fn) => {
          const r = results.get(fn.id);
          return (
            <div
              key={fn.id}
              className="rounded-md border border-border bg-muted/30 p-3 text-sm"
            >
              <p className="text-xs text-muted-foreground">
                {r?.decoded?.label ?? labelForFn(fn.name)}
              </p>
              {r === undefined ? (
                <p className="mt-1 text-muted-foreground">—</p>
              ) : r.error ? (
                <p
                  className="mt-1 text-xs text-destructive"
                  title={r.error}
                >
                  오류
                </p>
              ) : r.decoded ? (
                <p className="mt-1 font-semibold">
                  {r.decoded.value}
                  {r.decoded.unit ? (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {r.decoded.unit}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-1 truncate font-mono text-xs" title={r.rawHex}>
                  {r.rawHex || "(빈 응답)"}
                </p>
              )}
              {r !== undefined && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatRelativeTime(r.at)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Fallback label when the decoder doesn't know the command — strip the
// "query_" prefix and humanize underscores: query_power_state → "전원 상태".
const FN_LABEL_HINTS: Record<string, string> = {
  query_power_state: "전원",
  query_input_source: "입력",
  query_lamp_hours: "램프 사용시간",
  query_lamp_state: "램프 상태",
  query_filter_hours: "필터 사용시간",
  query_model_name: "모델",
  query_serial_number: "S/N",
  query_firmware_version: "펌웨어",
  query_temperature: "내부 온도",
  query_error_status: "에러 상태",
  query_volume: "볼륨",
  query_mute_audio: "음소거",
  query_mute_video: "영상 차단",
  query_aspect_ratio: "화면비",
  query_brightness: "밝기",
  query_contrast: "대비",
  query_freeze: "정지화면",
};

function labelForFn(name: string): string {
  if (FN_LABEL_HINTS[name]) return FN_LABEL_HINTS[name];
  return name.replace(/^query_/, "").replace(/_/g, " ");
}

function formatRelativeTime(t: number): string {
  const diff = Date.now() - t;
  if (diff < 5_000) return "방금 전";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}초 전`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  return new Date(t).toLocaleTimeString();
}
