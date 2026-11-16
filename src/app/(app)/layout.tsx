import { prisma } from "@/lib/db";
import { leadScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/constants";
import { AppShell, type NavGroup } from "@/components/shell";
import { logout } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const scope = { deletedAt: null, ...leadScope(u) };
  const [dueFollowUps, neverCalled] = await Promise.all([
    prisma.followUp.count({ where: { done: false, dueAt: { lt: new Date() }, lead: scope, ...(can(u.role, "lead:view_all") ? {} : { userId: u.id }) } }),
    prisma.lead.count({ where: { ...scope, status: "NEW", callAttempts: 0 } }),
  ]);

  const groups: NavGroup[] = [
    {
      title: "Workspace",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "home" },
        { href: "/leads", label: "Leads", icon: "list", badge: neverCalled, badgeTone: "blue" },
        { href: "/board", label: "Pipeline", icon: "board" },
        { href: "/follow-ups", label: "Follow-ups", icon: "bell", badge: dueFollowUps, badgeTone: "red" },
      ],
    },
  ];
  if (can(u.role, "reports:view")) groups.push({ title: "Insights", items: [{ href: "/reports", label: "Reports", icon: "chart" }] });
  const manage = [
    ...(can(u.role, "lead:import") ? [{ href: "/import", label: "Import Leads", icon: "upload" }] : []),
    ...(can(u.role, "user:manage") ? [{ href: "/users", label: "Users & Roles", icon: "users" }] : []),
    ...(can(u.role, "lead:restore") ? [{ href: "/trash", label: "Trash", icon: "trash" }] : []),
    ...(can(u.role, "settings:manage") ? [{ href: "/settings", label: "Integrations", icon: "gear" }] : []),
    ...(can(u.role, "audit:view") ? [{ href: "/audit", label: "Audit Log", icon: "shield" }] : []),
  ];
  if (manage.length) groups.push({ title: "Manage", items: manage });

  return (
    <AppShell
      groups={groups}
      user={{ name: u.name, role: ROLE_LABEL[u.role], email: u.email }}
      notifications={dueFollowUps}
      canCreate={can(u.role, "lead:create")}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
