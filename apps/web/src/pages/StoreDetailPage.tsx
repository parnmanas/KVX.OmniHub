import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  useDeleteEquipment,
  useEquipments,
} from "@/features/equipments/use-equipments";
import { useOmnihubs } from "@/features/omnihubs/use-omnihubs";
import {
  useStore,
  useUpdateStore,
} from "@/features/stores/use-stores";
import {
  useInstantiateTemplate,
  useTemplates,
} from "@/features/templates/use-templates";

const TYPE_LABELS: Record<string, string> = {
  AC: "에어컨",
  PROJECTOR: "프로젝터",
  TV: "TV",
  LIGHT: "조명",
  DOOR_LOCK: "도어락",
  PC: "컴퓨터",
  OTHER: "기타",
};

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore(id);
  const equipments = useEquipments(id);
  const updateStore = useUpdateStore(id ?? "");
  const deleteEquipment = useDeleteEquipment();
  const [openAdd, setOpenAdd] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  if (!id) return null;
  if (store.isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중…</p>;
  }
  if (!store.data) {
    return <p className="text-sm text-destructive">매장을 찾을 수 없어요.</p>;
  }

  const eq = equipments.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/stores"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 매장 목록
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {editingName !== null ? (
            <form
              className="flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingName.trim()) {
                  await updateStore.mutateAsync({ name: editingName.trim() });
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
              <h1 className="text-xl font-semibold">{store.data.name}</h1>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingName(store.data!.name)}
              >
                이름 변경
              </Button>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {store.data.address ?? "주소 없음"}
          {store.data.phone ? ` · ${store.data.phone}` : ""}
        </p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">장비</h2>
          <Button onClick={() => setOpenAdd(true)}>+ 장비 추가</Button>
        </div>

        {eq.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            등록된 장비가 없어요. "장비 관리" 메뉴에서 템플릿을 먼저 만들고 추가하세요.
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
                    {e.omnihub ? (
                      <span
                        className={
                          e.omnihub.status === "online"
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }
                      >
                        {e.omnihub.name ?? e.omnihub.deviceId} (
                        {e.omnihub.status})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        할당 안 됨
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
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`"${e.name}" 장비를 삭제할까요?`)) {
                        deleteEquipment.mutate({
                          id: e.id,
                          storeId: e.storeId,
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
        storeId={id}
        open={openAdd}
        onClose={() => setOpenAdd(false)}
      />
    </div>
  );
}

function AddEquipmentModal({
  storeId,
  open,
  onClose,
}: {
  storeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const templates = useTemplates();
  const omnihubs = useOmnihubs();
  const instantiate = useInstantiateTemplate();
  const [templateId, setTemplateId] = useState<string>("");
  const [name, setName] = useState("");
  const [omnihubId, setOmnihubId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const availableHubs = useMemo(
    () =>
      omnihubs.data?.filter(
        (h) => !h.equipment && (h.storeId === storeId || h.storeId === null),
      ) ?? [],
    [omnihubs.data, storeId],
  );

  const selectedTemplate = templates.data?.find((t) => t.id === templateId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!templateId) {
      setError("템플릿을 선택하세요.");
      return;
    }
    try {
      await instantiate.mutateAsync({
        templateId,
        input: {
          storeId,
          name,
          omnihubId: omnihubId || undefined,
        },
      });
      setTemplateId("");
      setName("");
      setOmnihubId("");
      onClose();
    } catch (err) {
      setError(`등록 실패: ${(err as Error).message}`);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="장비 추가"
      description="장비 관리에 등록된 템플릿을 골라 매장에 배치합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
                [{TYPE_LABELS[t.type] ?? t.type}] {t.name} ({t.manufacturer}{" "}
                {t.model})
              </option>
            ))}
          </Select>
          {templates.data && templates.data.length === 0 && (
            <p className="text-xs text-muted-foreground">
              등록된 템플릿이 없어요.{" "}
              <Link
                to="/templates"
                className="text-foreground underline"
              >
                장비 관리에서 먼저 추가하세요
              </Link>
              .
            </p>
          )}
          {selectedTemplate && (
            <p className="text-xs text-muted-foreground">
              이 템플릿의 기능 {selectedTemplate.functions?.length ?? 0}개가 그대로 복제됩니다.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>이 매장에서 부를 이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 메인 룸 에어컨"
            required
          />
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
            disabled={instantiate.isPending || !templates.data?.length}
          >
            {instantiate.isPending ? "등록 중…" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
