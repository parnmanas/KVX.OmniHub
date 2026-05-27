import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useUpdateLocation } from "./use-locations";
import type { Location } from "./types";

/**
 * Edit dialog for a location. OmniHub placement now lives on the OmniHubs
 * page (Hub.locationId) rather than as a pointer on the location, so this
 * modal is just the name.
 */
export function EditLocationModal({
  location,
  onClose,
}: {
  location: Location | null;
  onClose: () => void;
}) {
  const updateLocation = useUpdateLocation();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location) {
      setName(location.name);
      setError(null);
    }
  }, [location]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!location) return;
    setError(null);
    try {
      await updateLocation.mutateAsync({
        id: location.id,
        input: {
          name: name.trim(),
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
      description="위치 이름을 수정합니다. OmniHub 배치는 OmniHubs 메뉴에서."
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
