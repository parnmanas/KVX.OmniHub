import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { EquipmentType } from "@omnihub/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  useCreateEquipmentFromPreset,
  useDeleteEquipment,
  useEquipments,
} from "@/features/equipments/use-equipments";
import {
  useDeleteLocation,
  useLocation,
} from "@/features/locations/use-locations";
import { EditLocationModal } from "@/features/locations/EditLocationModal";
import { useOmnihubs } from "@/features/omnihubs/use-omnihubs";
import { usePresets } from "@/features/presets/use-presets";
import {
  useInstantiateTemplate,
  useTemplates,
} from "@/features/templates/use-templates";
import { useNavigate } from "react-router-dom";

const TYPE_LABELS: Record<string, string> = {
  AC: "에어컨",
  PROJECTOR: "프로젝터",
  TV: "TV",
  LIGHT: "조명",
  DOOR_LOCK: "도어락",
  PC: "컴퓨터",
  OTHER: "기타",
};

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation(id);
  const equipments = useEquipments(id);
  const deleteLocation = useDeleteLocation();
  const deleteEquipment = useDeleteEquipment();
  const navigate = useNavigate();
  const [openAdd, setOpenAdd] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);

  if (!id) return null;
  if (location.isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중…</p>;
  }
  if (!location.data) {
    return <p className="text-sm text-destructive">위치를 찾을 수 없어요.</p>;
  }

  const loc = location.data;
  const storeId = loc.storeId;
  const eq = equipments.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/stores/${storeId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {loc.store?.name ?? "매장"} 상세
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{loc.name}</h1>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditLocationOpen(true)}
          >
            편집
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              if (
                confirm(
                  `위치 "${loc.name}" 를 삭제할까요? 안에 있는 모든 장비도 함께 삭제됩니다.`,
                )
              ) {
                await deleteLocation.mutateAsync({
                  id: loc.id,
                  storeId,
                });
                navigate(`/stores/${storeId}`);
              }
            }}
          >
            위치 삭제
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {loc.store?.name ?? "—"} 의 위치
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          이 위치의 OmniHub:{" "}
          {(loc.devices ?? []).length === 0 ? (
            <span>없음 · 매장 hub 로 fallback</span>
          ) : (
            <span>
              {loc.devices!.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <span
                    className={
                      d.status === "online"
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    {d.name ?? d.deviceId}
                  </span>
                </span>
              ))}
            </span>
          )}
        </p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">장비</h2>
          <Button onClick={() => setOpenAdd(true)}>+ 장비 추가</Button>
        </div>

        {eq.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            등록된 장비가 없어요. "+ 장비 추가" 로 시작하세요.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {eq.map((e) => (
              <Card key={e.id} className="flex flex-col p-5">
                <div className="flex-1">
                  <div className="text-base font-medium">{e.name}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {TYPE_LABELS[e.type] ?? e.type} · {e.manufacturer}{" "}
                    {e.model}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    OmniHub:{" "}
                    {e.resolvedOmnihub ? (
                      <>
                        <span
                          className={
                            e.resolvedOmnihub.status === "online"
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }
                        >
                          {e.resolvedOmnihub.name ??
                            e.resolvedOmnihub.deviceId}{" "}
                          ({e.resolvedOmnihub.status})
                        </span>
                        {e.resolvedOmnihubSource !== "equipment" && (
                          <span className="ml-1 italic">
                            (
                            {e.resolvedOmnihubSource === "location"
                              ? "위치"
                              : "매장"}{" "}
                            상속)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-destructive">
                        할당 안 됨 — 매장 / 위치 / 장비 어디에도 hub 없음
                      </span>
                    )}
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Link to={`/equipments/${e.id}`}>
                    <Button variant="outline" size="sm">
                      기능 관리
                    </Button>
                  </Link>
                  <Link to={`/equipments/${e.id}?edit=1`}>
                    <Button variant="outline" size="sm">
                      편집
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`"${e.name}" 장비를 삭제할까요?`)) {
                        deleteEquipment.mutate({
                          id: e.id,
                          locationId: e.locationId,
                        });
                      }
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <AddEquipmentModal
        locationId={id}
        storeId={storeId}
        open={openAdd}
        onClose={() => setOpenAdd(false)}
      />
      <EditLocationModal
        location={editLocationOpen ? loc : null}
        onClose={() => setEditLocationOpen(false)}
      />
    </div>
  );
}

function AddEquipmentModal({
  locationId,
  storeId,
  open,
  onClose,
}: {
  locationId: string;
  storeId: string;
  open: boolean;
  onClose: () => void;
}) {
  // Two source modes for a new equipment:
  //   - "preset": pick from baked-in IRDB-style presets (lg-tv, samsung-tv, …)
  //   - "template": pick from user-created templates
  const [mode, setMode] = useState<"preset" | "template">("preset");
  const presets = usePresets();
  const templates = useTemplates();
  const omnihubs = useOmnihubs();
  const fromPreset = useCreateEquipmentFromPreset();
  const instantiate = useInstantiateTemplate();
  const [presetType, setPresetType] = useState<string>("");
  const [presetName, setPresetName] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [name, setName] = useState("");
  const [omnihubId, setOmnihubId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Only show preset types that actually have at least one preset.
  const presetTypeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const p of presets.data ?? []) seen.add(p.device);
    return Object.values(EquipmentType).filter((t) => seen.has(t));
  }, [presets.data]);

  const filteredPresets = useMemo(
    () => (presets.data ?? []).filter((p) => p.device === presetType),
    [presets.data, presetType],
  );

  // Hubs are scoped to a store (not a location). With 1:N hub→equipment
  // we no longer filter out already-bound hubs — a single hub legitimately
  // services multiple equipments in the same room.
  const availableHubs = useMemo(
    () =>
      omnihubs.data?.filter(
        (h) => h.storeId === storeId || h.storeId === null,
      ) ?? [],
    [omnihubs.data, storeId],
  );

  const selectedTemplate = templates.data?.find((t) => t.id === templateId);
  const selectedPreset = presets.data?.find((p) => p.name === presetName);

  function reset() {
    setPresetType("");
    setPresetName("");
    setTemplateId("");
    setName("");
    setOmnihubId("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "preset") {
        if (!presetName) {
          setError("프리셋을 선택하세요.");
          return;
        }
        await fromPreset.mutateAsync({
          locationId,
          preset: presetName,
          name: name.trim() || undefined,
          omnihubId: omnihubId || undefined,
        });
      } else {
        if (!templateId) {
          setError("템플릿을 선택하세요.");
          return;
        }
        await instantiate.mutateAsync({
          templateId,
          input: {
            locationId,
            name,
            omnihubId: omnihubId || undefined,
          },
        });
      }
      reset();
      onClose();
    } catch (err) {
      setError(`등록 실패: ${(err as Error).message}`);
    }
  }

  const submitting = fromPreset.isPending || instantiate.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="장비 추가"
      description="알려진 기기는 프리셋 한 번 클릭으로, 직접 만든 템플릿이 있으면 그쪽에서 골라 추가합니다."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode toggle */}
        <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode("preset");
              setError(null);
            }}
            className={`rounded px-3 py-1.5 ${
              mode === "preset"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            프리셋에서 시작
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("template");
              setError(null);
            }}
            className={`rounded px-3 py-1.5 ${
              mode === "template"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            내 템플릿에서
          </button>
        </div>

        {mode === "preset" ? (
          <>
            <div className="space-y-2">
              <Label>종류</Label>
              <Select
                value={presetType}
                onChange={(e) => {
                  setPresetType(e.target.value);
                  setPresetName("");
                }}
                required
              >
                <option value="">선택…</option>
                {presetTypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </Select>
              {presets.data && presets.data.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  사용 가능한 프리셋이 없어요. tools/ir-presets/ 를 확인하세요.
                </p>
              )}
            </div>

            {presetType && (
              <div className="space-y-2">
                <Label>프리셋</Label>
                <Select
                  value={presetName}
                  onChange={(e) => {
                    setPresetName(e.target.value);
                    const p = presets.data?.find(
                      (pp) => pp.name === e.target.value,
                    );
                    if (p && !name) setName(`${p.brand} ${p.device}`);
                  }}
                  required
                >
                  <option value="">선택…</option>
                  {filteredPresets.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.brand}
                      {p.variant ? ` · ${p.variant}` : ""} ({p.commandCount}개
                      명령)
                    </option>
                  ))}
                </Select>
                {filteredPresets.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    이 종류로 등록된 프리셋이 없어요.
                  </p>
                )}
                {selectedPreset && (
                  <p className="text-xs text-muted-foreground">
                    {selectedPreset.commandCount}개 기능이 자동으로 함께
                    생성됩니다.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <Label>장비 템플릿</Label>
            <Select
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                const t = templates.data?.find((tt) => tt.id === e.target.value);
                if (t && !name) setName(t.name);
              }}
              required
            >
              <option value="">선택…</option>
              {templates.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  [{TYPE_LABELS[t.type] ?? t.type}] {t.name} ({t.manufacturer} {t.model})
                </option>
              ))}
            </Select>
            {templates.data && templates.data.length === 0 && (
              <p className="text-xs text-muted-foreground">
                등록된 템플릿이 없어요.{" "}
                <Link to="/templates" className="text-foreground underline">
                  장비 관리에서 먼저 추가
                </Link>
                하거나 위의 "프리셋에서 시작"을 사용하세요.
              </p>
            )}
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground">
                이 템플릿의 기능 {selectedTemplate.functions?.length ?? 0}개가 그대로 복제됩니다.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>이 위치에서 부를 이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 메인 룸 TV"
            required={mode === "template"}
          />
          {mode === "preset" && (
            <p className="text-xs text-muted-foreground">
              비워두면 "{selectedPreset ? `${selectedPreset.brand} ${selectedPreset.device}` : "(브랜드명) (기기)"}"로 저장됩니다.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>OmniHub 할당 (선택)</Label>
          <Select
            value={omnihubId}
            onChange={(e) => setOmnihubId(e.target.value)}
          >
            <option value="">미할당</option>
            {availableHubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name ?? h.deviceId} ({h.status})
              </option>
            ))}
          </Select>
          {availableHubs.length === 0 && (
            <p className="text-xs text-muted-foreground">
              할당 가능한 OmniHub 가 없어요. OmniHub 메뉴에서 먼저 등록/할당하세요.
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
          <Button
            type="submit"
            disabled={
              submitting ||
              (mode === "preset" && !presets.data?.length) ||
              (mode === "template" && !templates.data?.length)
            }
          >
            {submitting ? "등록 중…" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
