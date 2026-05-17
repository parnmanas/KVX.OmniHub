import { useState, type FormEvent } from "react";
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

const PAYLOAD_EXAMPLES: Record<string, FunctionPayload> = {
  IR: {
    controlType: "IR",
    data: {
      protocol: "NEC",
      decoded: { value: "0x20DF10EF", bits: 32 },
      raw: [],
    },
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
                  <th className="px-4 py-3">Payload</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {fns.map((fn) => (
                  <FunctionRow
                    key={fn.id}
                    fn={fn}
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
  onDelete,
}: {
  fn: TemplateFunction;
  onDelete: () => void;
}) {
  const [showJson, setShowJson] = useState(false);
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowJson((v) => !v)}
          >
            {showJson ? "접기" : "보기"}
          </Button>
        </td>
        <td className="px-4 py-3 text-right">
          <Button variant="destructive" size="sm" onClick={onDelete}>
            삭제
          </Button>
        </td>
      </tr>
      {showJson && (
        <tr className="bg-muted/30">
          <td colSpan={5} className="px-4 py-3">
            <pre className="overflow-x-auto rounded bg-background p-3 text-xs">
              {JSON.stringify(fn.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
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
      description="실제 IR 학습은 Phase 5 에서 자동화됩니다. 지금은 JSON 으로 직접 입력해요."
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
        </div>
        <div className="space-y-2">
          <Label>Payload (JSON)</Label>
          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            className="h-48 w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
            spellCheck={false}
          />
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
          <Button type="submit" disabled={createFunction.isPending}>
            {createFunction.isPending ? "저장 중…" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
