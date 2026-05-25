import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useOmnihubs } from "@/features/omnihubs/use-omnihubs";
import { useUpdateLocation } from "./use-locations";
import type { Location } from "./types";

/**
 * Full-fledged Location edit dialog. Used both from store detail (location
 * card) and from location detail page header. Covers name + the location's
 * default OmniHub (Equipment → Location → Store fallback chain).
 */
export function EditLocationModal({
  location,
  onClose,
}: {
  location: Location | null;
  onClose: () => void;
}) {
  const updateLocation = useUpdateLocation();
  const omnihubs = useOmnihubs();
  const [name, setName] = useState("");
  const [omnihubId, setOmnihubId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location) {
      setName(location.name);
      setOmnihubId(location.omnihubId ?? "");
      setError(null);
    }
  }, [location]);

  // Prefer hubs belonging to the same store or unassigned hubs.
  const hubOptions = (omnihubs.data ?? []).filter(
    (h) =>
      !location ||
      h.storeId === null ||
      h.storeId === location.storeId,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!location) return;
    setError(null);
    try {
      await updateLocation.mutateAsync({
        id: location.id,
        input: {
          name: name.trim(),
          omnihubId: omnihubId === "" ? null : omnihubId,
        },
      });
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "저장 실패");
    }
  }

  return (
    <Modal
      open={location !== null}
      onClose={onClose}
      title="위치 편집"
      description="위치 이름과 기본 OmniHub 를 수정합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label>기본 OmniHub</Label>
          <Select
            value={omnihubId}
            onChange={(e) => setOmnihubId(e.target.value)}
          >
            <option value="">— 매장 설정 따름 —</option>
            {hubOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name ?? h.deviceId}
                {h.status === "online" ? "" : " · 오프라인"}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            장비별로 hub 가 지정되지 않으면 이 hub 가 우선. 비워두면 매장
            기본 hub 로 fallback.
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
          <Button type="submit" disabled={updateLocation.isPending}>
            {updateLocation.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
