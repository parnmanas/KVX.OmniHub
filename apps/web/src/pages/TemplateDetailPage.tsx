import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ControlType, type FunctionPayload } from "@omnihub/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  useCreateTemplateFunction,
  useDeleteTemplateFunction,
  useRecordTemplateFunction,
  useTemplate,
  useUpdateTemplate,
  useUpdateTemplateFunction,
} from "@/features/templates/use-templates";
import { useOmnihubs } from "@/features/omnihubs/use-omnihubs";
import type { TemplateFunction } from "@/features/templates/types";

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

const PAYLOAD_EXAMPLES: Record<string, FunctionPayload> = {
  IR: {
    controlType: "IR",
    data: { protocol: "UNKNOWN", decoded: null, raw: [] },
  },
  WOL: EMPTY_PAYLOADS.WOL,
  HTTP_API: EMPTY_PAYLOADS.HTTP_API,
  RELAY: EMPTY_PAYLOADS.RELAY,
};

function isIrRecorded(fn: TemplateFunction): boolean {
  if (fn.controlType !== "IR") return false;
  if (fn.payload.controlType !== "IR") return false;
  const ir = fn.payload.data;
  return ir.decoded !== null || (Array.isArray(ir.raw) && ir.raw.length > 0);
}

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const template = useTemplate(id);
  const omnihubs = useOmnihubs();
  const updateTemplate = useUpdateTemplate();
  const deleteFunction = useDeleteTemplateFunction(id ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [selectedHubId, setSelectedHubId] = useState<string>("");

  const onlineHubs = useMemo(
    () => (omnihubs.data ?? []).filter((h) => h.status === "online"),
    [omnihubs.data],
  );

  if (!id) return null;
  if (template.isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중…</p>;
  }
  if (!template.data) {
    return (
      <p className="text-sm text-destructive">템플릿을 찾을 수 없어요.</p>
    );
  }

  const tpl = template.data;
  const fns = tpl.functions ?? [];
  const activeHub =
    onlineHubs.find((h) => h.id === selectedHubId) ?? onlineHubs[0];
  const effectiveHubId = activeHub?.id ?? "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/templates"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 장비 관리
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {editingName !== null ? (
            <form
              className="flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingName.trim()) {
                  await updateTemplate.mutateAsync({
                    id: tpl.id,
                    input: { name: editingName.trim() },
                  });
                  setEditingName(null);
                }
              }}
            >
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                className="w-64"
              />
              <Button type="submit" size="sm">
                저장
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditingName(null)}
              >
                취소
              </Button>
            </form>
          ) : (
            <>
              <h1 className="text-xl font-semibold">{tpl.name}</h1>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingName(tpl.name)}
              >
                이름 변경
              </Button>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {TYPE_LABELS[tpl.type] ?? tpl.type} · {tpl.manufacturer} {tpl.model}
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px] space-y-2">
            <Label>녹음에 사용할 OmniHub</Label>
            <Select
              value={effectiveHubId}
              onChange={(e) => setSelectedHubId(e.target.value)}
              disabled={onlineHubs.length === 0}
            >
              {onlineHubs.length === 0 ? (
                <option value="">온라인 상태의 OmniHub 가 없어요</option>
              ) : (
                onlineHubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name ?? h.deviceId}
                    {h.store ? ` · ${h.store.name}` : ""}
                  </option>
                ))
              )}
            </Select>
            <p className="text-xs text-muted-foreground">
              이 템플릿의 IR 기능들은 선택한 OmniHub 의 IR 수신부로 녹음됩니다.
              녹음 후 매장에 instantiate 하면 payload 가 그대로 복사돼요.
            </p>
          </div>
          {omnihubs.data && omnihubs.data.length > 0 && onlineHubs.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              등록된 OmniHub 가 전부 오프라인입니다.
            </p>
          )}
        </div>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">기능</h2>
          <Button onClick={() => setAddOpen(true)}>+ 기능 추가</Button>
        </div>

        {fns.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            아직 기능이 없어요. (예: 전원, 온도+, 풍속, 채널+ 등)
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
                    templateId={tpl.id}
                    omnihubId={effectiveHubId}
                    onDelete={() => {
                      if (confirm(`"${fn.name}" 기능을 삭제할까요?`)) {
                        deleteFunction.mutate(fn.id);
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
        templateId={tpl.id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}

function FunctionRow({
  fn,
  templateId,
  omnihubId,
  onDelete,
}: {
  fn: TemplateFunction;
  templateId: string;
  omnihubId: string;
  onDelete: () => void;
}) {
  const [showJson, setShowJson] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const recordMutation = useRecordTemplateFunction(templateId);
  const [recordOpen, setRecordOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isIr = fn.controlType === "IR";
  const recorded = isIrRecorded(fn);
  const canRecord = Boolean(omnihubId);
  const disabledReason = !canRecord ? "온라인 OmniHub 가 필요해요" : "";

  async function handleRecord() {
    if (!omnihubId) return;
    setActionError(null);
    setRecordOpen(true);
    try {
      await recordMutation.mutateAsync({
        id: fn.id,
        omnihubId,
        timeoutMs: LEARN_TIMEOUT_MS,
      });
    } catch (err) {
      setActionError(extractError(err));
    } finally {
      setRecordOpen(false);
    }
  }

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
              <Button
                size="sm"
                variant="outline"
                disabled={!canRecord || recordMutation.isPending}
                title={disabledReason}
                onClick={handleRecord}
              >
                {recorded ? "재녹음" : "● 녹음"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
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
        templateId={templateId}
        fn={fn}
        open={editOpen}
        onClose={() => setEditOpen(false)}
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
  templateId,
  open,
  onClose,
}: {
  templateId: string;
  open: boolean;
  onClose: () => void;
}) {
  const createFunction = useCreateTemplateFunction(templateId);
  const [name, setName] = useState("");
  const [controlType, setControlType] = useState<string>(ControlType.IR);
  const [order, setOrder] = useState("0");
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(PAYLOAD_EXAMPLES.IR, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  function changeType(next: string) {
    setControlType(next);
    setPayloadText(JSON.stringify(PAYLOAD_EXAMPLES[next], null, 2));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let payload: FunctionPayload;
    if (controlType === "IR") {
      // IR 은 폼에서 JSON 직접 입력 대신 빈 페이로드로 만들고, 행에서 녹음.
      payload = EMPTY_PAYLOADS.IR;
    } else {
      try {
        payload = JSON.parse(payloadText);
      } catch {
        setError("payload JSON 파싱 실패");
        return;
      }
      if (payload.controlType !== controlType) {
        setError(
          `payload.controlType 이 controlType(${controlType}) 과 일치해야 해요.`,
        );
        return;
      }
    }
    try {
      await createFunction.mutateAsync({
        name,
        controlType: controlType as never,
        payload,
        order: parseInt(order, 10) || 0,
      });
      setName("");
      setOrder("0");
      setPayloadText(JSON.stringify(PAYLOAD_EXAMPLES[controlType], null, 2));
      onClose();
    } catch (err) {
      setError(`서버 오류: ${(err as Error).message}`);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="기능 추가"
      description="IR 기능은 추가 후 행의 '● 녹음' 으로 신호를 캡처하세요."
      className="max-w-2xl"
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
            onChange={(e) => changeType(e.target.value)}
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
        {controlType !== "IR" && (
          <div className="space-y-2">
            <Label>Payload (JSON)</Label>
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="h-48 w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
              spellCheck={false}
            />
          </div>
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
          <Button type="submit" disabled={createFunction.isPending}>
            {createFunction.isPending ? "저장 중…" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditFunctionModal({
  templateId,
  fn,
  open,
  onClose,
}: {
  templateId: string;
  fn: TemplateFunction;
  open: boolean;
  onClose: () => void;
}) {
  const updateFunction = useUpdateTemplateFunction(templateId);
  const [name, setName] = useState(fn.name);
  const [order, setOrder] = useState(String(fn.order));
  const [icon, setIcon] = useState(fn.icon ?? "");
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(fn.payload, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  const isIr = fn.controlType === "IR";

  // Reset local state whenever the modal opens for a different/refreshed fn.
  useEffect(() => {
    if (open) {
      setName(fn.name);
      setOrder(String(fn.order));
      setIcon(fn.icon ?? "");
      setPayloadText(JSON.stringify(fn.payload, null, 2));
      setError(null);
    }
  }, [open, fn]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const input: {
      name?: string;
      icon?: string;
      order?: number;
      payload?: FunctionPayload;
    } = {};
    if (name.trim() && name.trim() !== fn.name) input.name = name.trim();
    const orderNum = parseInt(order, 10);
    if (!Number.isNaN(orderNum) && orderNum !== fn.order) {
      input.order = orderNum;
    }
    const nextIcon = icon.trim();
    if ((fn.icon ?? "") !== nextIcon) {
      input.icon = nextIcon;
    }

    if (!isIr) {
      let payload: FunctionPayload;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        setError("payload JSON 파싱 실패");
        return;
      }
      if (payload.controlType !== fn.controlType) {
        setError(
          `payload.controlType 이 controlType(${fn.controlType}) 과 일치해야 해요.`,
        );
        return;
      }
      if (JSON.stringify(payload) !== JSON.stringify(fn.payload)) {
        input.payload = payload;
      }
    }

    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }
    try {
      await updateFunction.mutateAsync({ id: fn.id, input });
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
        isIr
          ? "IR 신호는 행에서 '● 녹음' / '재녹음' 으로만 갱신할 수 있어요."
          : "Payload 는 JSON 으로 직접 편집합니다."
      }
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-2">
          <Label>아이콘 (선택)</Label>
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="예: power"
          />
        </div>
        <div className="space-y-2">
          <Label>제어 방식</Label>
          <Input value={fn.controlType} disabled readOnly />
          <p className="text-xs text-muted-foreground">
            제어 방식 변경은 지원하지 않아요. 필요하면 삭제 후 새로 추가하세요.
          </p>
        </div>
        {!isIr && (
          <div className="space-y-2">
            <Label>Payload (JSON)</Label>
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="h-48 w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
              spellCheck={false}
            />
          </div>
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
          <Button type="submit" disabled={updateFunction.isPending}>
            {updateFunction.isPending ? "저장 중…" : "저장"}
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
