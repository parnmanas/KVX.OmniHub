import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  useCreateLocation,
  useLocations,
} from "@/features/locations/use-locations";
import {
  useStore,
  useUpdateStore,
} from "@/features/stores/use-stores";

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore(id);
  const locations = useLocations(id);
  const updateStore = useUpdateStore(id ?? "");
  const [openAdd, setOpenAdd] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  if (!id) return null;
  if (store.isLoading) {
    return <p className="text-sm text-muted-foreground">로딩 중…</p>;
  }
  if (!store.data) {
    return <p className="text-sm text-destructive">매장을 찾을 수 없어요.</p>;
  }

  const locs = locations.data ?? [];

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
          <h2 className="text-base font-semibold">위치</h2>
          <Button onClick={() => setOpenAdd(true)}>+ 위치 추가</Button>
        </div>

        {locs.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            등록된 위치가 없어요. 매장 안의 공간(예: "1층 홀", "VIP 룸 A")을
            먼저 만들고, 그 안에 장비를 추가하세요.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locs.map((loc) => {
              const equipCount = loc.equipments?.length ?? 0;
              return (
                <Card key={loc.id} className="flex flex-col p-5">
                  <div className="flex-1">
                    <div className="text-base font-medium">{loc.name}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      장비 {equipCount}개
                    </p>
                    {equipCount > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {loc.equipments!.slice(0, 4).map((e) => (
                          <li key={e.id}>· {e.name}</li>
                        ))}
                        {equipCount > 4 && (
                          <li className="italic">… 외 {equipCount - 4}개</li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Link to={`/locations/${loc.id}`}>
                      <Button variant="outline" size="sm">
                        위치 상세 / 장비 관리
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <AddLocationModal
        storeId={id}
        open={openAdd}
        onClose={() => setOpenAdd(false)}
      />
    </div>
  );
}

function AddLocationModal({
  storeId,
  open,
  onClose,
}: {
  storeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const createLocation = useCreateLocation(storeId);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createLocation.mutateAsync({ name: name.trim() });
      setName("");
      onClose();
    } catch (err) {
      setError(`등록 실패: ${(err as Error).message}`);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="위치 추가"
      description="이 매장 안의 공간 이름을 적어주세요. 예: 1층 홀, 2층 VIP 룸 A, 주방."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 1층 홀"
            required
            autoFocus
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
          <Button type="submit" disabled={createLocation.isPending}>
            {createLocation.isPending ? "저장 중…" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
