import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { FunctionPayload } from "@omnihub/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useIrTest, useOmnihub } from "@/features/omnihubs/use-omnihubs";
import {
  useRecordTemplateFunction,
  useTemplate,
  useTemplates,
} from "@/features/templates/use-templates";
import type {
  EquipmentTemplate,
  TemplateFunction,
} from "@/features/templates/types";

const LEARN_TIMEOUT_MS = 10_000;

const TYPE_LABELS: Record<string, string> = {
  AC: "에어컨",
  PROJECTOR: "프로젝터",
  TV: "TV",
  LIGHT: "조명",
  DOOR_LOCK: "도어락",
  PC: "컴퓨터",
  OTHER: "기타",
};

function isIrRecorded(fn: TemplateFunction): boolean {
  if (fn.controlType !== "IR") return false;
  if (fn.payload.controlType !== "IR") return false;
  const ir = fn.payload.data;
  return ir.decoded !== null || (Array.isArray(ir.raw) && ir.raw.length > 0);
}

export default function HubRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const templateId = searchParams.get("template") ?? "";

  const hub = useOmnihub(id);

  if (!id) return null;
  if (hub.isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중…</p>;
  }
  if (!hub.data) {
    return <p className="text-sm text-destructive">OmniHub 를 찾을 수 없어요.</p>;
  }

  const h = hub.data;
  const isOnline = h.status === "online";

  function pickTemplate(tplId: string) {
    setSearchParams({ template: tplId });
  }
  function clearTemplate() {
    setSearchParams({});
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/omnihubs"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← OmniHub 목록
        </Link>
        <h1 className="mt-2 text-xl font-semibold">IR 신호 녹음</h1>
        <p className="text-sm text-muted-foreground">
          이 OmniHub 의 IR 수신부로 리모컨 신호를 캡처해 템플릿 기능에 학습시킵니다.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              녹음 중인 OmniHub
            </p>
            <p className="text-lg font-semibold">{h.name ?? h.deviceId}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {h.deviceId}
            </p>
            {h.store && (
              <p className="text-xs text-muted-foreground">
                매장: {h.store.name}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isOnline
                ? "bg-green-100 text-green-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            ● {h.status}
          </span>
        </div>
        {!isOnline && (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            이 OmniHub 는 현재 오프라인입니다. 녹음을 시작하려면 디바이스 전원/네트워크를 먼저 확인하세요.
          </p>
        )}
      </Card>

      {templateId ? (
        <TemplateRecordingSection
          templateId={templateId}
          omnihubId={h.id}
          omnihubLabel={h.name ?? h.deviceId}
          canRecord={isOnline}
          onChangeTemplate={clearTemplate}
        />
      ) : (
        <TemplatePicker onPick={pickTemplate} />
      )}
    </div>
  );
}

function TemplatePicker({ onPick }: { onPick: (id: string) => void }) {
  const templates = useTemplates();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const list = templates.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) =>
      [t.name, t.manufacturer, t.model, t.type]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [templates.data, query]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">학습시킬 장비 (템플릿) 선택</h2>
          <p className="text-sm text-muted-foreground">
            제조사 / 모델명 / 이름으로 검색해서 고르세요.
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: LG, S-W092H, 에어컨"
          className="w-72"
        />
      </div>

      {templates.isLoading ? (
        <p className="text-sm text-muted-foreground">로딩 중…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {query
            ? `"${query}" 와 일치하는 템플릿이 없어요.`
            : "등록된 템플릿이 없어요. 먼저 템플릿을 만들어주세요."}
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {filtered.slice(0, 50).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onPick(t.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">
                        {TYPE_LABELS[t.type] ?? t.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.manufacturer} {t.model}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">선택 →</span>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > 50 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {filtered.length} 개 중 50 개 표시 중. 검색어를 좁혀주세요.
            </p>
          )}
        </Card>
      )}
    </section>
  );
}

function TemplateRecordingSection({
  templateId,
  omnihubId,
  omnihubLabel,
  canRecord,
  onChangeTemplate,
}: {
  templateId: string;
  omnihubId: string;
  omnihubLabel: string;
  canRecord: boolean;
  onChangeTemplate: () => void;
}) {
  const template = useTemplate(templateId);

  if (template.isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중…</p>;
  }
  if (!template.data) {
    return (
      <Card className="p-6 text-sm">
        <p className="text-destructive">템플릿을 찾을 수 없어요.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onChangeTemplate}
        >
          다른 템플릿 선택
        </Button>
      </Card>
    );
  }

  const tpl = template.data;
  const fns = tpl.functions ?? [];
  const irFns = fns.filter((f) => f.controlType === "IR");
  const recordedCount = irFns.filter(isIrRecorded).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{tpl.name}</h2>
          <p className="text-sm text-muted-foreground">
            {TYPE_LABELS[tpl.type] ?? tpl.type} · {tpl.manufacturer} {tpl.model}
            {irFns.length > 0 && (
              <span className="ml-2 text-xs">
                ({recordedCount}/{irFns.length} IR 녹음됨)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onChangeTemplate}>
            다른 템플릿 선택
          </Button>
          <Link to={`/templates/${tpl.id}`}>
            <Button variant="ghost" size="sm">
              템플릿 편집 →
            </Button>
          </Link>
        </div>
      </div>

      {fns.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          이 템플릿에 기능이 없어요.
          <br />
          <Link
            to={`/templates/${tpl.id}`}
            className="text-primary hover:underline"
          >
            템플릿 편집 페이지
          </Link>{" "}
          에서 기능을 먼저 추가하세요.
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
                <RecordRow
                  key={fn.id}
                  fn={fn}
                  templateId={tpl.id}
                  omnihubId={omnihubId}
                  omnihubLabel={omnihubLabel}
                  canRecord={canRecord}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

function RecordRow({
  fn,
  templateId,
  omnihubId,
  omnihubLabel,
  canRecord,
}: {
  fn: TemplateFunction;
  templateId: string;
  omnihubId: string;
  omnihubLabel: string;
  canRecord: boolean;
}) {
  const recordMutation = useRecordTemplateFunction(templateId);
  const irTestMutation = useIrTest();
  const [open, setOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playSuccess, setPlaySuccess] = useState(false);

  const isIr = fn.controlType === "IR";
  const recorded = isIrRecorded(fn);

  async function handleRecord() {
    setError(null);
    setOpen(true);
    try {
      await recordMutation.mutateAsync({
        id: fn.id,
        omnihubId,
        timeoutMs: LEARN_TIMEOUT_MS,
      });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setOpen(false);
    }
  }

  async function handlePlay() {
    if (fn.payload.controlType !== "IR") return;
    setError(null);
    setPlaySuccess(false);
    try {
      await irTestMutation.mutateAsync({
        omnihubId,
        payload: fn.payload.data,
      });
      setPlaySuccess(true);
      setTimeout(() => setPlaySuccess(false), 1500);
    } catch (err) {
      setError(extractError(err));
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
            <span className="text-xs text-muted-foreground">
              IR 외 — 녹음 불필요
            </span>
          )}
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
            {isIr && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canRecord || recordMutation.isPending}
                  title={!canRecord ? "OmniHub 가 오프라인입니다" : ""}
                  onClick={handleRecord}
                >
                  {recorded ? "재녹음" : "● 녹음"}
                </Button>
                <Button
                  size="sm"
                  disabled={
                    !canRecord || !recorded || irTestMutation.isPending
                  }
                  title={
                    !canRecord
                      ? "OmniHub 가 오프라인입니다"
                      : !recorded
                        ? "먼저 녹음하세요"
                        : ""
                  }
                  onClick={handlePlay}
                >
                  {irTestMutation.isPending
                    ? "전송 중…"
                    : playSuccess
                      ? "✓ 전송됨"
                      : "▶ 재생"}
                </Button>
              </>
            )}
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
      {error && (
        <tr className="border-b border-border bg-destructive/10">
          <td colSpan={5} className="px-4 py-2 text-xs text-destructive">
            오류: {error}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setError(null)}
            >
              닫기
            </button>
          </td>
        </tr>
      )}
      <RecordingModal
        open={open}
        functionName={fn.name}
        omnihubLabel={omnihubLabel}
        timeoutMs={LEARN_TIMEOUT_MS}
      />
    </>
  );
}

function RecordingModal({
  open,
  functionName,
  omnihubLabel,
  timeoutMs,
}: {
  open: boolean;
  functionName: string;
  omnihubLabel: string;
  timeoutMs: number;
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        /* recording cannot be cancelled mid-flight */
      }}
      title="리모컨 신호 녹음 중"
      description={`"${functionName}" 기능에 학습할 버튼을 IR 수신부를 향해 한 번 누르세요.`}
    >
      <div className="space-y-3 text-sm">
        <div className="rounded border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">OmniHub: </span>
          <span className="font-medium">{omnihubLabel}</span>
        </div>
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

export type { EquipmentTemplate };
