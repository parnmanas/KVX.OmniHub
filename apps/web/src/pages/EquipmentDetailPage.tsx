import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ControlType, type FunctionPayload } from "@omnihub/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useEquipment } from "@/features/equipments/use-equipments";
import {
  useCreateEquipmentFunction,
  useDeleteEquipmentFunction,
  useEquipmentFunctions,
  usePlayEquipmentFunction,
  useRecordEquipmentFunction,
} from "@/features/equipments/use-equipment-functions";
import type { EquipmentFunction } from "@/features/equipments/types";

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
};

function isIrRecorded(fn: EquipmentFunction): boolean {
  if (fn.controlType !== "IR") return false;
  if (fn.payload.controlType !== "IR") return false;
  const ir = fn.payload.data;
  return ir.decoded !== null || (Array.isArray(ir.raw) && ir.raw.length > 0);
}

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const equipment = useEquipment(id);
  const functions = useEquipmentFunctions(id);
  const deleteFn = useDeleteEquipmentFunction(id ?? "");
  const [addOpen, setAddOpen] = useState(false);

  if (!id) return null;
  if (equipment.isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중…</p>;
  }
  if (!equipment.data) {
    return <p className="text-sm text-destructive">장비를 찾을 수 없어요.</p>;
  }

  const eq = equipment.data;
  const fns = functions.data ?? [];
  const omnihubOnline = eq.omnihub?.status === "online";

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
        </div>
        <p className="text-sm text-muted-foreground">
          {eq.manufacturer} {eq.model}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          OmniHub:{" "}
          {eq.omnihub ? (
            <span
              className={
                eq.omnihub.status === "online"
                  ? "text-green-600"
                  : "text-muted-foreground"
              }
            >
              {eq.omnihub.name ?? eq.omnihub.deviceId} ({eq.omnihub.status})
            </span>
          ) : (
            <span className="text-destructive">할당 안 됨</span>
          )}
        </p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">기능</h2>
          <Button onClick={() => setAddOpen(true)}>+ 기능 추가</Button>
        </div>

        {!eq.omnihubId && (
          <Card className="mb-3 border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            이 장비에 OmniHub 가 할당되지 않아 녹음/재생이 불가합니다. 매장 상세에서 할당하세요.
          </Card>
        )}
        {eq.omnihubId && !omnihubOnline && (
          <Card className="mb-3 border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            OmniHub 가 오프라인 상태입니다. 녹음/재생이 실패할 수 있어요.
          </Card>
        )}

        {fns.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            아직 기능이 없어요. 위 "+ 기능 추가" 로 시작하세요.
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
                    canControl={Boolean(eq.omnihubId)}
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
      </section>

      <AddFunctionModal
        equipmentId={id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}

function FunctionRow({
  fn,
  equipmentId,
  canControl,
  omnihubOnline,
  onDelete,
}: {
  fn: EquipmentFunction;
  equipmentId: string;
  canControl: boolean;
  omnihubOnline: boolean;
  onDelete: () => void;
}) {
  const [showJson, setShowJson] = useState(false);
  const recordMutation = useRecordEquipmentFunction(equipmentId);
  const playMutation = usePlayEquipmentFunction();
  const [recordOpen, setRecordOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [playSuccess, setPlaySuccess] = useState(false);

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
    try {
      await playMutation.mutateAsync(fn.id);
      setPlaySuccess(true);
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
    </>
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
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createFn.mutateAsync({
        name,
        controlType: controlType as never,
        payload: EMPTY_PAYLOADS[controlType],
        order: parseInt(order, 10) || 0,
      });
      setName("");
      setOrder("0");
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
      description="기능을 먼저 만들고, 이후 행에서 '● 녹음' 으로 IR 신호를 학습하세요."
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
