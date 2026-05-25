import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  useCreateOmnihub,
  useDeleteOmnihub,
  useOmnihubs,
  useUpdateOmnihub,
} from "@/features/omnihubs/use-omnihubs";
import {
  useClaimPairing,
  usePendingPairings,
  type PendingPairing,
} from "@/features/omnihubs/use-pairing";
import { useStores } from "@/features/stores/use-stores";
import type { Omnihub } from "@/features/omnihubs/types";

export default function OmnihubsPage() {
  const hubs = useOmnihubs();
  const stores = useStores();
  const pending = usePendingPairings();
  const deleteHub = useDeleteOmnihub();
  const updateHub = useUpdateOmnihub();
  const [openCreate, setOpenCreate] = useState(false);
  const [pairingForCode, setPairingForCode] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">OmniHub</h1>
          <p className="text-sm text-muted-foreground">
            연결된 ESP32 컨트롤러를 페어링하고 매장/장비에 할당합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPairingForCode("")}
          >
            페어링 코드 입력
          </Button>
          <Button onClick={() => setOpenCreate(true)}>+ 수동 등록</Button>
        </div>
      </div>

      {pending.data && pending.data.length > 0 && (
        <PendingPairingsCard
          pendings={pending.data}
          onPick={(code) => setPairingForCode(code)}
        />
      )}

      {hubs.isLoading && (
        <p className="text-sm text-muted-foreground">로딩 중…</p>
      )}
      {hubs.data && hubs.data.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          등록된 OmniHub 가 없어요.
        </Card>
      )}

      {hubs.data && hubs.data.length > 0 && (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">Device ID (MAC)</th>
                <th className="px-4 py-3">매장</th>
                <th className="px-4 py-3">장비</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {hubs.data.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-4 py-3">{h.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {h.deviceId}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={h.storeId ?? ""}
                      onChange={(e) =>
                        updateHub.mutate({
                          id: h.id,
                          input: { storeId: e.target.value || null },
                        })
                      }
                      className="h-8"
                    >
                      <option value="">미할당</option>
                      {stores.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {h.equipments && h.equipments.length > 0 ? (
                      <span title={h.equipments.map((e) => e.name).join(", ")}>
                        {h.equipments.length === 1
                          ? h.equipments[0].name
                          : `${h.equipments[0].name} 외 ${h.equipments.length - 1}개`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {h.status === "online" ? (
                        <Link to={`/omnihubs/${h.id}/record`}>
                          <Button
                            size="sm"
                            variant="outline"
                            title="이 OmniHub 로 IR 신호 녹음"
                          >
                            ● 녹음
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title="OmniHub 가 오프라인입니다"
                        >
                          ● 녹음
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              `OmniHub "${h.name ?? h.deviceId}" 를 삭제할까요?`,
                            )
                          ) {
                            deleteHub.mutate(h.id);
                          }
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CreateOmnihubModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
      />
      <PairingModal
        open={pairingForCode !== null}
        initialCode={pairingForCode ?? ""}
        onClose={() => setPairingForCode(null)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: Omnihub["status"] }) {
  const cls =
    status === "online"
      ? "bg-green-100 text-green-700"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      ●&nbsp;{status}
    </span>
  );
}

function PendingPairingsCard({
  pendings,
  onPick,
}: {
  pendings: PendingPairing[];
  onPick: (code: string) => void;
}) {
  return (
    <Card className="border-amber-300 bg-amber-50/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-amber-900">
            페어링 대기 중인 디바이스
          </h2>
          <p className="text-xs text-amber-800/80">
            아래 코드를 입력해서 디바이스를 등록하세요.
          </p>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {pendings.map((p) => (
          <li
            key={p.pairingCode}
            className="flex items-center justify-between rounded-md border border-amber-300 bg-background px-3 py-2"
          >
            <div>
              <span className="font-mono text-base font-semibold tracking-widest">
                {p.pairingCode}
              </span>
              <span className="ml-3 font-mono text-xs text-muted-foreground">
                {p.deviceId}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {p.waitingSeconds}s 대기
              </span>
              <Button size="sm" onClick={() => onPick(p.pairingCode)}>
                등록
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PairingModal({
  open,
  initialCode,
  onClose,
}: {
  open: boolean;
  initialCode: string;
  onClose: () => void;
}) {
  const stores = useStores();
  const claim = useClaimPairing();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync external initialCode changes when modal reopens
  if (open && initialCode && code === "" && initialCode !== code) {
    setCode(initialCode);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await claim.mutateAsync({
        pairingCode: code.trim().toUpperCase(),
        name: name.trim() || undefined,
        storeId: storeId || undefined,
      });
      setCode("");
      setName("");
      setStoreId("");
      onClose();
    } catch (err) {
      setError("페어링에 실패했어요. 코드가 맞는지 확인하세요.");
      console.error(err);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="OmniHub 페어링"
      description="디바이스에 표시된 6자리 코드를 입력하세요."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>페어링 코드</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: AB12CD"
            className="font-mono tracking-widest"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>표시 이름 (선택)</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 1층 입구 IR Hub"
          />
        </div>
        <div className="space-y-2">
          <Label>매장 할당 (선택)</Label>
          <Select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">미할당</option>
            {stores.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
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
          <Button type="submit" disabled={claim.isPending}>
            {claim.isPending ? "등록 중…" : "등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateOmnihubModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const stores = useStores();
  const createHub = useCreateOmnihub();
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await createHub.mutateAsync({
      deviceId,
      name: name.trim() || undefined,
      storeId: storeId || undefined,
    });
    setDeviceId("");
    setName("");
    setStoreId("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="OmniHub 수동 등록"
      description="실제 디바이스 페어링 없이 행만 만들 때 사용합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Device ID (MAC)</Label>
          <Input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="AA:BB:CC:DD:EE:FF"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>표시 이름 (선택)</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>매장 할당 (선택)</Label>
          <Select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">미할당</option>
            {stores.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={createHub.isPending}>
            {createHub.isPending ? "저장 중…" : "등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
