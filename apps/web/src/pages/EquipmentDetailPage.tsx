import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ControlType, type FunctionPayload } from "@omnihub/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  useEquipment,
  useUpdateEquipment,
} from "@/features/equipments/use-equipments";
import {
  useCreateEquipmentFunction,
  useDeleteEquipmentFunction,
  useEquipmentFunctions,
  usePlayEquipmentFunction,
  useRecordEquipmentFunction,
  useUpdateEquipmentFunction,
} from "@/features/equipments/use-equipment-functions";
import type {
  Equipment,
  EquipmentFunction,
} from "@/features/equipments/types";
import { useOmnihubs } from "@/features/omnihubs/use-omnihubs";
import { decodeRs232Response } from "@/features/rs232/decoders";
import { Rs232PayloadEditor } from "@/features/rs232/Rs232PayloadEditor";
import { CapabilityPanel } from "@/features/capabilities/CapabilityPanel";

const TYPE_LABELS: Record<string, string> = {
  AC: "에어컨",
  PROJECTOR: "프로젝터",
  TV: "TV",
  LIGHT: "조명",
  DOOR_LOCK: "도어락",
  PC: "컴퓨터",
  OTHER: "기타",
};

const LEARN_TIMEOUT_MS = 10_000;

const EMPTY_PAYLOADS: Record<string, FunctionPayload> = {
  IR: {
    controlType: "IR",
    data: { protocol: "UNKNOWN", decoded: null, raw: [] },
  },
  WOL: {
    controlType: "WOL",
    data: { mac: "AA:BB:CC:DD:EE:FF", broadcastIp: "192.168.0.255" },
  },
  HTTP_API: {
    controlType: "HTTP_API",
    data: { method: "GET", url: "http://192.168.0.50/relay/0?turn=on" },
  },
  RELAY: {
    controlType: "RELAY",
    data: { channel: 0, state: "ON", durationMs: 3000 },
  },
  RS232: {
    controlType: "RS232",
    data: { baud: 9600, dataBits: 8, parity: "none", stopBits: 1, bytes: [] },
  },
};

function isIrRecorded(fn: EquipmentFunction): boolean {
  if (fn.controlType !== "IR") return false;
  if (fn.payload.controlType !== "IR") return false;
  const ir = fn.payload.data;
  return ir.decoded !== null || (Array.isArray(ir.raw) && ir.raw.length > 0);
}

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const equipment = useEquipment(id);
  const functions = useEquipmentFunctions(id);
  const deleteFn = useDeleteEquipmentFunction(id ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Auto-refresh preference for the status panel. Persisted per equipment
  // so technicians who care about lamp hours can leave it on a 30s tick
  // while the rest of the system stays quiet.
  const autoRefreshKey = id ? `rs232-auto-refresh:${id}` : "";
  const [autoRefreshMs, setAutoRefreshMsState] = useState<number>(() => {
    if (!autoRefreshKey || typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(autoRefreshKey);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  });
  const setAutoRefreshMs = useCallback(
    (ms: number) => {
      setAutoRefreshMsState(ms);
      if (autoRefreshKey && typeof window !== "undefined") {
        window.localStorage.setItem(autoRefreshKey, String(ms));
      }
    },
    [autoRefreshKey],
  );

  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setEditOpen(true);
      searchParams.delete("edit");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!id) return null;
  if (equipment.isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중…</p>;
  }
  if (!equipment.data) {
    return <p className="text-sm text-destructive">장비를 찾을 수 없어요.</p>;
  }

  const eq = equipment.data;
  const fns = functions.data ?? [];
  // We control via whichever hub the server WILL use (Equipment → Location
  // → Store fallback). Looking only at eq.omnihubId would mis-disable
  // buttons whenever the hub is inherited from a higher level.
  const resolvedHub = eq.resolvedOmnihub;
  const resolvedSource = eq.resolvedOmnihubSource;
  const omnihubOnline = resolvedHub?.status === "online";
  const canControl = Boolean(resolvedHub);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/locations/${eq.locationId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 위치 상세
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{eq.name}</h1>
          <span className="rounded bg-muted px-2 py-0.5 text-xs">
            {TYPE_LABELS[eq.type] ?? eq.type}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            편집
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {eq.manufacturer} {eq.model}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          OmniHub:{" "}
          {resolvedHub ? (
            <>
              <span
                className={
                  resolvedHub.status === "online"
                    ? "text-green-600"
                    : "text-muted-foreground"
                }
              >
                {resolvedHub.name ?? resolvedHub.deviceId} (
                {resolvedHub.status})
              </span>
              {resolvedSource !== "equipment" && (
                <span className="ml-2 italic">
                  ({resolvedSource === "location" ? "위치" : "매장"} 기본 hub 상속)
                </span>
              )}
            </>
          ) : (
            <span className="text-destructive">할당 안 됨</span>
          )}
        </p>
      </div>

      <CapabilityPanel
        brand={eq.manufacturer}
        capabilities={eq.capabilities ?? []}
        canControl={canControl && omnihubOnline}
        autoRefreshMs={autoRefreshMs}
        onAutoRefreshChange={setAutoRefreshMs}
      />

      {!canControl && (
        <Card className="border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          장비 / 위치 / 매장 어느 단계에도 OmniHub 가 할당되지 않아 녹음/재생이 불가합니다.
          장비 편집 또는 위치/매장 편집에서 hub 를 할당하세요.
        </Card>
      )}
      {canControl && !omnihubOnline && (
        <Card className="border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          사용할 OmniHub ({resolvedHub?.name ?? resolvedHub?.deviceId}) 가
          오프라인 상태입니다. 녹음/재생이 실패할 수 있어요.
        </Card>
      )}

      <section>
        <details>
          <summary className="cursor-pointer select-none">
            <h2 className="inline text-base font-semibold">
              고급 · Raw 기능 ({fns.length})
            </h2>
            <span className="ml-2 text-xs text-muted-foreground">
              각 명령을 직접 실행하거나 새 기능을 추가합니다.
            </span>
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setAddOpen(true)}>+ 기능 추가</Button>
            </div>
            {fns.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">
                아직 기능이 없어요. "+ 기능 추가" 로 시작하세요.
              </Card>
            ) : (
              <Card>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-3">순서</th>
                      <th className="px-4 py-3">이름</th>
                      <th className="px-4 py-3">방식</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3 text-right">동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fns.map((fn) => (
                      <FunctionRow
                        key={fn.id}
                        fn={fn}
                        equipmentId={id}
                        brand={eq.manufacturer}
                        canControl={canControl}
                        omnihubOnline={omnihubOnline}
                        onDelete={() => {
                          if (confirm(`"${fn.name}" 기능을 삭제할까요?`)) {
                            deleteFn.mutate(fn.id);
                          }
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </details>
      </section>

      <AddFunctionModal
        equipmentId={id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
      <EditEquipmentModal
        equipment={eq}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

function EditEquipmentModal({
  equipment,
  open,
  onClose,
}: {
  equipment: Equipment;
  open: boolean;
  onClose: () => void;
}) {
  const updateEquipment = useUpdateEquipment();
  const omnihubs = useOmnihubs();
  const [name, setName] = useState(equipment.name);
  const [manufacturer, setManufacturer] = useState(equipment.manufacturer);
  const [model, setModel] = useState(equipment.model);
  const [omnihubId, setOmnihubId] = useState<string>(equipment.omnihubId ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(equipment.name);
      setManufacturer(equipment.manufacturer);
      setModel(equipment.model);
      setOmnihubId(equipment.omnihubId ?? "");
      setError(null);
    }
  }, [open, equipment]);

  const storeId = equipment.location?.storeId;
  const hubOptions = (omnihubs.data ?? []).filter(
    (h) => !storeId || h.storeId === null || h.storeId === storeId,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateEquipment.mutateAsync({
        id: equipment.id,
        input: {
          name: name.trim(),
          manufacturer: manufacturer.trim(),
          model: model.trim(),
          omnihubId: omnihubId === "" ? null : omnihubId,
        },
      });
      onClose();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="장비 편집" description="장비 정보와 OmniHub 할당을 수정합니다.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>제조사</Label>
            <Input
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>모델</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>OmniHub 할당</Label>
          <Select
            value={omnihubId}
            onChange={(e) => setOmnihubId(e.target.value)}
          >
            <option value="">— 할당 안 함 —</option>
            {hubOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name ?? h.deviceId}
                {h.store ? ` · ${h.store.name}` : " · (매장 미할당)"}
                {h.status === "online" ? "" : " · 오프라인"}
              </option>
            ))}
          </Select>
          {storeId && (
            <p className="text-xs text-muted-foreground">
              이 장비가 속한 매장의 OmniHub만 표시돼요. 다른 매장의 OmniHub에
              할당하려면 먼저 OmniHub 페이지에서 매장을 변경하세요.
            </p>
          )}
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={updateEquipment.isPending}>
            {updateEquipment.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FunctionRow({
  fn,
  equipmentId,
  brand,
  canControl,
  omnihubOnline,
  onDelete,
}: {
  fn: EquipmentFunction;
  equipmentId: string;
  brand: string;
  canControl: boolean;
  omnihubOnline: boolean;
  onDelete: () => void;
}) {
  const [showJson, setShowJson] = useState(false);
  const recordMutation = useRecordEquipmentFunction(equipmentId);
  const playMutation = usePlayEquipmentFunction();
  const [recordOpen, setRecordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [playSuccess, setPlaySuccess] = useState(false);
  // RS232 status reply (hex string + decoded ASCII view). Cleared on the
  // next play attempt; sticky until the user dismisses it so they can
  // read the projector's response without it disappearing.
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const isIr = fn.controlType === "IR";
  const recorded = isIrRecorded(fn);

  async function handleRecord() {
    setActionError(null);
    setRecordOpen(true);
    try {
      await recordMutation.mutateAsync({
        id: fn.id,
        timeoutMs: LEARN_TIMEOUT_MS,
      });
    } catch (err) {
      setActionError(extractError(err));
    } finally {
      setRecordOpen(false);
    }
  }

  async function handlePlay() {
    setActionError(null);
    setPlaySuccess(false);
    setLastResponse(null);
    try {
      const result = await playMutation.mutateAsync(fn.id);
      setPlaySuccess(true);
      // Only RS232 status queries come back with a non-null response.
      if (result.response) setLastResponse(result.response);
      setTimeout(() => setPlaySuccess(false), 1500);
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  const disableControl = !canControl || !omnihubOnline;
  const controlDisabledReason = !canControl
    ? "OmniHub 미할당"
    : !omnihubOnline
      ? "OmniHub 오프라인"
      : "";

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-4 py-3 text-muted-foreground">{fn.order}</td>
        <td className="px-4 py-3 font-medium">{fn.name}</td>
        <td className="px-4 py-3">
          <span className="rounded bg-muted px-2 py-0.5 text-xs">
            {fn.controlType}
          </span>
        </td>
        <td className="px-4 py-3">
          {isIr ? (
            recorded ? (
              <span className="text-xs text-green-600">
                녹음됨
                {fn.payload.controlType === "IR" &&
                fn.payload.data.protocol !== "UNKNOWN"
                  ? ` (${fn.payload.data.protocol})`
                  : ""}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">미녹음</span>
            )
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowJson((v) => !v)}
            >
              {showJson ? "접기" : "Payload 보기"}
            </Button>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            {isIr && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disableControl || recordMutation.isPending}
                  title={controlDisabledReason}
                  onClick={handleRecord}
                >
                  {recorded ? "재녹음" : "● 녹음"}
                </Button>
                <Button
                  size="sm"
                  disabled={
                    disableControl || !recorded || playMutation.isPending
                  }
                  title={
                    !recorded
                      ? "먼저 녹음하세요"
                      : controlDisabledReason || ""
                  }
                  onClick={handlePlay}
                >
                  {playMutation.isPending
                    ? "전송 중…"
                    : playSuccess
                      ? "✓ 전송됨"
                      : "▶ 재생"}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              수정
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              삭제
            </Button>
          </div>
        </td>
      </tr>
      {actionError && (
        <tr className="border-b border-border bg-destructive/10">
          <td colSpan={5} className="px-4 py-2 text-xs text-destructive">
            오류: {actionError}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setActionError(null)}
            >
              닫기
            </button>
          </td>
        </tr>
      )}
      {lastResponse && (
        <tr className="border-b border-border bg-blue-50 dark:bg-blue-950/30">
          <td colSpan={5} className="px-4 py-2 text-xs">
            {(() => {
              const decoded = decodeRs232Response(brand, fn.name, lastResponse);
              return (
                <>
                  {decoded ? (
                    <>
                      <span className="font-medium text-blue-900 dark:text-blue-200">
                        {decoded.label}:
                      </span>
                      <span className="ml-2 font-semibold text-blue-900 dark:text-blue-200">
                        {decoded.value}
                        {decoded.unit ? ` ${decoded.unit}` : ""}
                      </span>
                      <span className="ml-3 text-muted-foreground">
                        (raw: {asciiFromHex(lastResponse)})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-blue-900 dark:text-blue-200">
                        응답:
                      </span>
                      <span className="ml-2 font-mono text-blue-900 dark:text-blue-200">
                        {asciiFromHex(lastResponse)}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        (hex: {lastResponse})
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    className="ml-2 underline text-blue-900 dark:text-blue-200"
                    onClick={() => setLastResponse(null)}
                  >
                    닫기
                  </button>
                </>
              );
            })()}
          </td>
        </tr>
      )}
      {showJson && !isIr && (
        <tr className="bg-muted/30">
          <td colSpan={5} className="px-4 py-3">
            <pre className="overflow-x-auto rounded bg-background p-3 text-xs">
              {JSON.stringify(fn.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}

      <RecordingModal
        open={recordOpen}
        functionName={fn.name}
        timeoutMs={LEARN_TIMEOUT_MS}
      />
      <EditFunctionModal
        fn={fn}
        equipmentId={equipmentId}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}

function EditFunctionModal({
  fn,
  equipmentId,
  open,
  onClose,
}: {
  fn: EquipmentFunction;
  equipmentId: string;
  open: boolean;
  onClose: () => void;
}) {
  const updateFn = useUpdateEquipmentFunction(equipmentId);
  const [name, setName] = useState(fn.name);
  const [order, setOrder] = useState(String(fn.order));
  const [payload, setPayload] = useState<FunctionPayload>(fn.payload);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(fn.name);
      setOrder(String(fn.order));
      setPayload(fn.payload);
      setError(null);
    }
  }, [open, fn]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateFn.mutateAsync({
        id: fn.id,
        input: {
          name: name.trim(),
          order: parseInt(order, 10) || 0,
          // Only send payload when it changed shape AND the user actually
          // edited an RS232 function. For IR we don't expose payload editing
          // here (use the record flow) so leaving payload alone is correct.
          ...(fn.controlType === "RS232" ? { payload } : {}),
        },
      });
      onClose();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="기능 수정"
      description={
        fn.controlType === "IR"
          ? "기능 이름과 순서를 수정합니다. IR 신호는 '● 녹음' 버튼으로 별도 변경하세요."
          : "기능 이름, 순서, 페이로드를 수정합니다."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-[1fr,120px] gap-3">
          <div className="space-y-2">
            <Label>이름</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>순서</Label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              min={0}
            />
          </div>
        </div>

        {fn.controlType === "RS232" && payload.controlType === "RS232" && (
          <div className="space-y-1">
            <Label>RS232 페이로드</Label>
            <Rs232PayloadEditor
              value={payload.data}
              onChange={(data) => setPayload({ controlType: "RS232", data })}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          제어 방식 ({fn.controlType}) 변경은 지원하지 않아요. 필요하면 새 기능을
          만든 뒤 기존 기능을 삭제하세요.
        </p>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={updateFn.isPending}>
            {updateFn.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RecordingModal({
  open,
  functionName,
  timeoutMs,
}: {
  open: boolean;
  functionName: string;
  timeoutMs: number;
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        /* recording cannot be cancelled mid-flight */
      }}
      title="리모컨 신호 녹음 중"
      description={`"${functionName}" 기능에 학습할 버튼을 OmniHub IR 수신부를 향해 한 번 누르세요.`}
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="inline-block size-3 animate-pulse rounded-full bg-red-500" />
          <span className="text-muted-foreground">
            최대 {Math.round(timeoutMs / 1000)} 초 대기합니다…
          </span>
        </div>
      </div>
    </Modal>
  );
}

function AddFunctionModal({
  equipmentId,
  open,
  onClose,
}: {
  equipmentId: string;
  open: boolean;
  onClose: () => void;
}) {
  const createFn = useCreateEquipmentFunction(equipmentId);
  const [name, setName] = useState("");
  const [controlType, setControlType] = useState<string>(ControlType.IR);
  const [order, setOrder] = useState("0");
  const [payload, setPayload] = useState<FunctionPayload>(
    EMPTY_PAYLOADS[ControlType.IR],
  );
  const [error, setError] = useState<string | null>(null);

  // Switching controlType resets the editor to that type's default payload.
  // The previous shape would silently send mismatched data (e.g. IR payload
  // with controlType=RS232), which the server rejects with a confusing
  // 400 — better to coerce client-side.
  useEffect(() => {
    setPayload(EMPTY_PAYLOADS[controlType] ?? EMPTY_PAYLOADS.IR);
  }, [controlType]);

  // Reset back to defaults whenever the modal opens fresh.
  useEffect(() => {
    if (open) {
      setName("");
      setOrder("0");
      setControlType(ControlType.IR);
      setPayload(EMPTY_PAYLOADS.IR);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createFn.mutateAsync({
        name,
        controlType: controlType as never,
        payload,
        order: parseInt(order, 10) || 0,
      });
      onClose();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="기능 추가"
      description="제어 방식에 따라 IR은 녹음으로, RS232/HTTP/WOL/RELAY는 페이로드를 직접 입력합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>이름</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 전원"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>순서</Label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              min={0}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>제어 방식</Label>
          <Select
            value={controlType}
            onChange={(e) => setControlType(e.target.value)}
          >
            {Object.values(ControlType).map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </Select>
          {controlType === "IR" && (
            <p className="text-xs text-muted-foreground">
              생성 후 행의 '● 녹음' 버튼을 눌러 리모컨 신호를 캡처하세요.
            </p>
          )}
        </div>

        {controlType === "RS232" && payload.controlType === "RS232" && (
          <Rs232PayloadEditor
            value={payload.data}
            onChange={(data) => setPayload({ controlType: "RS232", data })}
          />
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={createFn.isPending}>
            {createFn.isPending ? "저장 중…" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Best-effort ASCII rendering of a hex response. Used as a fallback view
// when the brand-specific decoder can't structure the reply (or as the
// "(raw: ...)" annotation next to the decoded value).
function asciiFromHex(hex: string): string {
  if (!hex) return "";
  let ascii = "";
  let printable = 0;
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(b)) return hex;
    // Replace control bytes with a visible glyph but still count them.
    if (b >= 0x20 && b < 0x7f) {
      ascii += String.fromCharCode(b);
      printable++;
    } else if (b === 0x0d) {
      ascii += "\\r";
    } else if (b === 0x0a) {
      ascii += "\\n";
    } else if (b === 0x02) {
      ascii += "<STX>";
    } else if (b === 0x03) {
      ascii += "<ETX>";
    } else {
      ascii += `\\x${b.toString(16).padStart(2, "0")}`;
    }
  }
  const total = hex.length / 2;
  // If most of the response is non-printable, fall back to a hex-only
  // view rather than render a wall of escape sequences.
  if (total === 0 || printable / total < 0.5) return `<${total} bytes>`;
  return ascii;
}

function extractError(err: unknown): string {
  const e = err as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const data = e?.response?.data?.message;
  if (Array.isArray(data)) return data.join(", ");
  if (typeof data === "string") return data;
  return e?.message ?? "알 수 없는 오류";
}
