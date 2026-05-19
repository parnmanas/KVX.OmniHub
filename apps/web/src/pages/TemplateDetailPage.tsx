import { useEffect, useState, type FormEvent } from "react";
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
  useTemplate,
  useUpdateTemplate,
  useUpdateTemplateFunction,
} from "@/features/templates/use-templates";
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
  IR: EMPTY_PAYLOADS.IR,
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
  const updateTemplate = useUpdateTemplate();
  const deleteFunction = useDeleteTemplateFunction(id ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

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
  const irFns = fns.filter((f) => f.controlType === "IR");
  const recordedCount = irFns.filter(isIrRecorded).length;

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
          {irFns.length > 0 && (
            <span className="ml-2 text-xs">
              ({recordedCount}/{irFns.length} IR 녹음됨)
            </span>
          )}
        </p>
      </div>

      <Card className="border-dashed border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">IR 신호 녹음은 OmniHub 페이지에서</p>
        <p className="mt-1 text-muted-foreground">
          이 페이지는 템플릿 구조(기능 추가·이름·순서·삭제)를 편집하는 곳이에요.
          실제 리모컨 신호 학습은{" "}
          <Link to="/omnihubs" className="text-primary hover:underline">
            OmniHub 목록
          </Link>{" "}
          에서 사용할 hub 옆 <span className="font-mono">● 녹음</span> 버튼으로
          진행하세요.
        </p>
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
  onDelete,
}: {
  fn: TemplateFunction;
  templateId: string;
  onDelete: () => void;
}) {
  const [showJson, setShowJson] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const isIr = fn.controlType === "IR";
  const recorded = isIrRecorded(fn);

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
          ) : null}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowJson((v) => !v)}
              disabled={isIr && !recorded}
              title={isIr && !recorded ? "아직 녹음되지 않은 IR 입니다" : ""}
            >
              {showJson ? "접기" : "보기"}
            </Button>
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
      {showJson && (
        <tr className="bg-muted/30">
          <td colSpan={5} className="px-4 py-3">
            <PayloadView payload={fn.payload} />
          </td>
        </tr>
      )}
      <EditFunctionModal
        templateId={templateId}
        fn={fn}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
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
      // IR 페이로드는 비워서 만들고, 녹음은 OmniHub 페이지에서.
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
      description="IR 기능은 추가 후 OmniHub 페이지에서 신호를 녹음하세요."
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
              생성 후 OmniHub 페이지의 ● 녹음 버튼으로 리모컨 신호를 학습하세요.
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
          ? "IR 신호는 OmniHub 페이지의 ● 녹음 으로만 갱신할 수 있어요."
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

function PayloadView({ payload }: { payload: FunctionPayload }) {
  if (payload.controlType === "IR") {
    const ir = payload.data;
    const rawLen = Array.isArray(ir.raw) ? ir.raw.length : 0;
    return (
      <div className="space-y-2">
        <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Protocol</dt>
          <dd className="font-mono">{ir.protocol}</dd>
          {ir.decoded ? (
            <>
              <dt className="text-muted-foreground">Decoded</dt>
              <dd className="font-mono">
                {ir.decoded.value}
                <span className="ml-2 text-muted-foreground">
                  ({ir.decoded.bits} bits)
                </span>
              </dd>
            </>
          ) : (
            <>
              <dt className="text-muted-foreground">Decoded</dt>
              <dd className="text-muted-foreground">— (raw timing only)</dd>
            </>
          )}
          <dt className="text-muted-foreground">Raw samples</dt>
          <dd className="font-mono">{rawLen}</dd>
        </dl>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            JSON 전체 보기
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-background p-3 text-xs">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      </div>
    );
  }
  return (
    <pre className="overflow-x-auto rounded bg-background p-3 text-xs">
      {JSON.stringify(payload, null, 2)}
    </pre>
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
