import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  useCreateStore,
  useDeleteStore,
  useStores,
} from "@/features/stores/use-stores";

export default function StoresPage() {
  const stores = useStores();
  const createStore = useCreateStore();
  const deleteStore = useDeleteStore();
  const [openCreate, setOpenCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">매장</h1>
          <p className="text-sm text-muted-foreground">
            매장을 등록하고 장비/OmniHub 를 할당합니다.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>+ 매장 추가</Button>
      </div>

      {stores.isLoading && (
        <p className="text-sm text-muted-foreground">로딩 중…</p>
      )}
      {stores.error && (
        <p className="text-sm text-destructive">
          매장 목록을 불러오지 못했어요.
        </p>
      )}

      {stores.data && stores.data.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          아직 등록된 매장이 없어요. 우측 상단의 "매장 추가" 로 시작하세요.
        </Card>
      )}

      {stores.data && stores.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.data.map((store) => (
            <Card key={store.id} className="flex flex-col p-5">
              <div className="flex-1">
                <Link
                  to={`/stores/${store.id}`}
                  className="text-base font-medium hover:underline"
                >
                  {store.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {store.address ?? "주소 없음"}
                </p>
                {store.phone && (
                  <p className="text-sm text-muted-foreground">
                    {store.phone}
                  </p>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Link to={`/stores/${store.id}`}>
                  <Button variant="outline" size="sm">
                    상세
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`"${store.name}" 매장을 삭제할까요?`)) {
                      deleteStore.mutate(store.id);
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

      <CreateStoreModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSubmit={async (input) => {
          await createStore.mutateAsync(input);
          setOpenCreate(false);
        }}
        submitting={createStore.isPending}
      />
    </div>
  );
}

function CreateStoreModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    address?: string;
    phone?: string;
  }) => Promise<void> | void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({
      name,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    setName("");
    setAddress("");
    setPhone("");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="매장 추가"
      description="매장 기본 정보를 입력하세요."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">매장명</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">주소</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">연락처</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
