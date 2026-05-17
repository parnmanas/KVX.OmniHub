import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useOmnihubs } from "@/features/omnihubs/use-omnihubs";
import { useStores } from "@/features/stores/use-stores";

export default function DashboardPage() {
  const stores = useStores();
  const hubs = useOmnihubs();

  const totalStores = stores.data?.length ?? 0;
  const totalHubs = hubs.data?.length ?? 0;
  const onlineHubs =
    hubs.data?.filter((h) => h.status === "online").length ?? 0;
  const assignedHubs =
    hubs.data?.filter((h) => h.equipment !== null).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">대시보드</h1>
        <p className="text-sm text-muted-foreground">
          시스템 전반의 현황을 한눈에 확인합니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="등록 매장" value={totalStores} href="/stores" />
        <StatCard label="등록 OmniHub" value={totalHubs} href="/omnihubs" />
        <StatCard
          label="온라인 OmniHub"
          value={`${onlineHubs} / ${totalHubs}`}
          href="/omnihubs"
        />
        <StatCard
          label="장비에 할당됨"
          value={`${assignedHubs} / ${totalHubs}`}
          href="/omnihubs"
        />
      </div>

      <Card className="p-6">
        <h2 className="text-base font-medium">다음 단계</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Phase 3 에서 ESP32 ↔ 서버 WebSocket 페어링 플로우가 들어옵니다.
        </p>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href: string;
}) {
  return (
    <Link to={href}>
      <Card className="p-5 transition-colors hover:bg-muted/40">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </Card>
    </Link>
  );
}
