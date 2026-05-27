import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useUpdateStore } from "./use-stores";
import type { Store } from "./types";

/**
 * Edit dialog for a store. The OmniHub fallback used to be configured here
 * via a "default hub" pointer column, but that's been retired in favor of
 * physical hub placement (Hub.storeId / Hub.locationId on the OmniHubs
 * page). So this modal is now just name/address/phone.
 */
export function EditStoreModal({
  store,
  onClose,
}: {
  store: Store | null;
  onClose: () => void;
}) {
  const updateStore = useUpdateStore(store?.id ?? "");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (store) {
      setName(store.name);
      setAddress(store.address ?? "");
      setPhone(store.phone ?? "");
      setError(null);
    }
  }, [store]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    setError(null);
    try {
      await updateStore.mutateAsync({
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "저장 실패");
    }
  }

  return (
    <Modal
      open={store !== null}
      onClose={onClose}
      title="매장 편집"
      description="매장 정보를 수정합니다. OmniHub 배치는 OmniHubs 메뉴에서."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>매장명</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label>주소</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>연락처</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
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
          <Button type="submit" disabled={updateStore.isPending}>
            {updateStore.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
