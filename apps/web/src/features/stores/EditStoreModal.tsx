import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useOmnihubs } from "@/features/omnihubs/use-omnihubs";
import { useUpdateStore } from "./use-stores";
import type { Store } from "./types";

/**
 * Full-fledged Store edit dialog. Used both from the store-list card and
 * from the store detail page header so editing is consistent. Covers
 * name, address, phone, AND the store's default OmniHub (used when an
 * equipment/location under this store has no hub of its own).
 */
export function EditStoreModal({
  store,
  onClose,
}: {
  store: Store | null;
  onClose: () => void;
}) {
  const updateStore = useUpdateStore(store?.id ?? "");
  const omnihubs = useOmnihubs();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [omnihubId, setOmnihubId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (store) {
      setName(store.name);
      setAddress(store.address ?? "");
      setPhone(store.phone ?? "");
      setOmnihubId(store.omnihubId ?? "");
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
        omnihubId: omnihubId === "" ? null : omnihubId,
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
      description="매장 정보와 매장 기본 OmniHub 를 수정합니다."
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
        <div className="space-y-2">
          <Label>기본 OmniHub</Label>
          <Select
            value={omnihubId}
            onChange={(e) => setOmnihubId(e.target.value)}
          >
            <option value="">— 없음 —</option>
            {omnihubs.data?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name ?? h.deviceId}
                {h.status === "online" ? "" : " · 오프라인"}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            장비/위치에 hub 가 따로 지정되지 않았을 때 이 hub 가 사용돼요.
          </p>
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
