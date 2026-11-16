import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/constants";
import { Sidebar } from "@/components/sidebar";
import { logout } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const items = [
    { href: "/dashboard", label: "Dashboard", icon: "home" },
    { href: "/leads", label: "Leads", icon: "list" },
    { href: "/board", label: "Pipeline Board", icon: "board" },
    { href: "/follow-ups", label: "Follow-ups", icon: "bell" },
    ...(can(u.role, "reports:view") ? [{ href: "/reports", label: "Reports", icon: "chart" }] : []),
    ...(can(u.role, "lead:import") ? [{ href: "/import", label: "Import Leads", icon: "upload" }] : []),
    ...(can(u.role, "user:manage") ? [{ href: "/users", label: "Users", icon: "users" }] : []),
    ...(can(u.role, "lead:restore") ? [{ href: "/trash", label: "Trash", icon: "trash" }] : []),
    ...(can(u.role, "settings:manage") ? [{ href: "/settings", label: "Settings & Integrations", icon: "gear" }] : []),
    ...(can(u.role, "audit:view") ? [{ href: "/audit", label: "Audit Log", icon: "shield" }] : []),
  ];
  return (
    <div className="min-h-screen">
      <Sidebar items={items} user={{ name: u.name, role: ROLE_LABEL[u.role] }} logout={logout} />
      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
