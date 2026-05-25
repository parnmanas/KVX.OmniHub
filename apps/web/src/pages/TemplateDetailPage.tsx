import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ControlType,
  type ControlType as ControlTypeT,
  type FunctionPayload,
} from "@omnihub/shared";
import type { PresetCommandPayload } from "@/features/presets/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { usePreset, usePresets } from "@/features/presets/use-presets";
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

// Render a preset command's protocol / value in the import preview table.
// Different control types want different summaries (IR shows protocol +
// decoded hex; RS232 shows baud + byte count; HTTP shows method + url).
function describePresetCommand(
  controlType: ControlTypeT,
  cmd: PresetCommandPayload,
): { label: string; value: string } {
  switch (controlType) {
    case "IR": {
      const ir = cmd as Extract<PresetCommandPayload, { protocol: string }>;
      return {
        label: ir.protocol,
        value: ir.decoded
          ? `${ir.decoded.value} (${ir.decoded.bits}b)`
          : `raw[${ir.raw.length}]`,
      };
    }
    case "RS232": {
      const rs = cmd as Extract<PresetCommandPayload, { baud: number }>;
      return {
        label: `${rs.baud} ${rs.dataBits}${rs.parity[0].toUpperCase()}${rs.stopBits}`,
        value: `${rs.bytes.length} bytes`,
      };
    }
    case "HTTP_API": {
      const h = cmd as Extract<PresetCommandPayload, { method: string }>;
      return { label: h.method, value: h.url };
    }
    case "RELAY": {
      const r = cmd as Extract<PresetCommandPayload, { channel: number }>;
      return {
        label: `ch${r.channel}`,
        value: r.durationMs ? `${r.state} ${r.durationMs}ms` : r.state,
      };
    }
    case "WOL": {
      const w = cmd as Extract<PresetCommandPayload, { mac: string }>;
      return { label: "WOL", value: w.mac };
    }
    default:
      return { label: controlType, value: "" };
  }
}

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
  const [importOpen, setImportOpen] = useState(false);
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              프리셋에서 가져오기
            </Button>
            <Button onClick={() => setAddOpen(true)}>+ 기능 추가</Button>
          </div>
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
      <ImportPresetModal
        templateId={tpl.id}
        existingNames={new Set(fns.map((f) => f.name))}
        open={importOpen}
        onClose={() => setImportOpen(false)}
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

function ImportPresetModal({
  templateId,
  existingNames,
  open,
  onClose,
}: {
  templateId: string;
  existingNames: Set<string>;
  open: boolean;
  onClose: () => void;
}) {
  const presets = usePresets();
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const presetDetail = usePreset(selectedPreset || null);
  const createFunction = useCreateTemplateFunction(templateId);

  // Per-command selection (default: import everything not already present).
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedPreset("");
      setPicked({});
      setProgress(null);
      setErrors([]);
      setOverwrite(false);
    }
  }, [open]);

  // When preset detail loads, default all commands to "selected" — but
  // pre-deselect any whose name already exists in the template (avoids
  // accidental duplicates).
  useEffect(() => {
    if (presetDetail.data) {
      const next: Record<string, boolean> = {};
      for (const cmd of Object.keys(presetDetail.data.commands)) {
        next[cmd] = !existingNames.has(cmd);
      }
      setPicked(next);
    }
  }, [presetDetail.data, existingNames]);

  const selectedCount = useMemo(
    () => Object.values(picked).filter(Boolean).length,
    [picked],
  );
  const totalCount = useMemo(
    () =>
      presetDetail.data
        ? Object.keys(presetDetail.data.commands).length
        : 0,
    [presetDetail.data],
  );

  function toggleAll(value: boolean) {
    if (!presetDetail.data) return;
    const next: Record<string, boolean> = {};
    for (const cmd of Object.keys(presetDetail.data.commands)) {
      // When toggling all-off, allow overriding the duplicate guard.
      next[cmd] = value;
    }
    setPicked(next);
  }

  async function handleImport() {
    if (!presetDetail.data) return;
    const toImport = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);
    if (toImport.length === 0) return;

    setProgress({ done: 0, total: toImport.length });
    setErrors([]);
    const failed: string[] = [];
    let done = 0;
    // Compute starting order: append after last existing.
    let nextOrder = existingNames.size;
    // Preset declares one controlType for ALL commands. Wrap each raw
    // payload in the matching discriminated FunctionPayload. The server
    // does the same on createFromPreset; here we mirror it for template
    // function import.
    const ct = (presetDetail.data?.controlType ?? "IR") as ControlTypeT;
    for (const cmdName of toImport) {
      const payload = presetDetail.data.commands[cmdName];
      try {
        if (existingNames.has(cmdName) && !overwrite) {
          failed.push(`${cmdName}: 이미 존재 (덮어쓰기 미체크)`);
          continue;
        }
        await createFunction.mutateAsync({
          name: cmdName,
          controlType: ct,
          payload: { controlType: ct, data: payload } as FunctionPayload,
          order: nextOrder++,
        });
      } catch (err) {
        failed.push(`${cmdName}: ${(err as Error).message}`);
      } finally {
        done++;
        setProgress({ done, total: toImport.length });
      }
    }
    setErrors(failed);
    if (failed.length === 0) {
      onClose();
    }
  }

  const running = progress !== null && progress.done < progress.total;

  return (
    <Modal
      open={open}
      onClose={running ? () => {} : onClose}
      title="프리셋에서 기능 가져오기"
      description="알려진 기기의 IR 명령 모음을 한 번에 템플릿에 추가합니다."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>프리셋</Label>
          <Select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            disabled={presets.isLoading || running}
          >
            <option value="">선택…</option>
            {presets.data?.map((p) => (
              <option key={p.name} value={p.name}>
                {p.brand} {p.device}
                {p.variant ? ` · ${p.variant}` : ""} — {p.commandCount}개 명령
              </option>
            ))}
          </Select>
          {presets.data && presets.data.length === 0 && (
            <p className="text-xs text-muted-foreground">
              사용 가능한 프리셋이 없어요. tools/ir-presets/ 디렉터리를 확인하세요.
            </p>
          )}
        </div>

        {presetDetail.isLoading && (
          <p className="text-sm text-muted-foreground">프리셋 로드 중…</p>
        )}

        {presetDetail.data && (
          <>
            {presetDetail.data.notes && presetDetail.data.notes.length > 0 && (
              <Card className="border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                {presetDetail.data.notes.map((n, i) => (
                  <p key={i}>{n}</p>
                ))}
              </Card>
            )}

            <div className="flex items-center justify-between">
              <Label>
                추가할 명령 ({selectedCount}/{totalCount})
              </Label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => toggleAll(true)}
                  disabled={running}
                >
                  모두 선택
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => toggleAll(false)}
                  disabled={running}
                >
                  모두 해제
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2">이름</th>
                    <th className="px-3 py-2">프로토콜</th>
                    <th className="px-3 py-2">값</th>
                    <th className="w-20 px-3 py-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(presetDetail.data.commands).map(
                    ([cmdName, cmd]) => {
                      const exists = existingNames.has(cmdName);
                      const desc = describePresetCommand(
                        presetDetail.data?.controlType ?? "IR",
                        cmd,
                      );
                      return (
                        <tr
                          key={cmdName}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={picked[cmdName] ?? false}
                              onChange={(e) =>
                                setPicked((prev) => ({
                                  ...prev,
                                  [cmdName]: e.target.checked,
                                }))
                              }
                              disabled={running}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{cmdName}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {desc.label}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {desc.value}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {exists ? (
                              <span className="text-amber-600">중복</span>
                            ) : (
                              <span className="text-muted-foreground">신규</span>
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                disabled={running}
              />
              같은 이름의 기능이 있어도 추가 (서버는 중복 이름을 허용함 — 정리는 수동)
            </label>
          </>
        )}

        {progress && (
          <Card className="bg-muted/30 p-3 text-sm">
            진행 {progress.done}/{progress.total}
            {progress.done === progress.total && (
              <span className="ml-2 text-green-600">완료</span>
            )}
          </Card>
        )}

        {errors.length > 0 && (
          <Card className="border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">건너뛰거나 실패한 항목 ({errors.length})</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={running}
          >
            {errors.length > 0 ? "닫기" : "취소"}
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!presetDetail.data || selectedCount === 0 || running}
          >
            {running
              ? `추가 중… ${progress!.done}/${progress!.total}`
              : `${selectedCount}개 추가`}
          </Button>
        </div>
      </div>
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
