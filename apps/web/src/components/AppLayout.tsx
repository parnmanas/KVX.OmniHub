import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLogout, useMe } from "@/features/auth/use-auth";
import { cn } from "@/lib/cn";

const navItems: Array<{ to: string; label: string }> = [
  { to: "/", label: "대시보드" },
  { to: "/stores", label: "매장" },
  { to: "/templates", label: "장비 관리" },
  { to: "/omnihubs", label: "OmniHub" },
];

export function AppLayout({ children }: { children?: ReactNode }) {
  const me = useMe();
  const logout = useLogout();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="w-56 border-r border-border bg-background">
        <div className="px-6 py-5 text-lg font-semibold">OmniHub</div>
        <nav className="px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-3 py-2 text-sm",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-border bg-background px-6 py-3 text-sm">
          <span className="text-muted-foreground">{me.data?.username}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout.mutate()}
          >
            로그아웃
          </Button>
        </header>
        <main className="flex-1 px-8 py-8">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
