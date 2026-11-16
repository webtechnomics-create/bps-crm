"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: string; badge?: number; badgeTone?: "red" | "amber" | "blue" };
export type NavGroup = { title: string; items: NavItem[] };

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  board: "M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v7h-4z",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3",
  plus: "M12 5v14M5 12h14",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  collapse: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  expand: "M13 17l5-5-5-5M6 17l5-5-5-5",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M18 6 6 18M6 6l12 12",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
  percent: "M19 5 5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  arrowRight: "M5 12h14M12 5l7 7-7 7",
};

export function Icon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Avatar({ name, size = "h-9 w-9 text-xs" }: { name: string; size?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const hues = ["bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700"];
  const h = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", size, h)}>{initials || "?"}</span>;
}

const BADGE: Record<string, string> = {
  red: "bg-rose-500 text-white",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-brand-100 text-brand-700",
};

export function AppShell({
  groups,
  user,
  notifications,
  canCreate,
  logout,
  children,
}: {
  groups: NavGroup[];
  user: { name: string; role: string; email: string };
  notifications: number;
  canCreate: boolean;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("bps-sidebar") === "1");
    } catch {}
  }, []);
  useEffect(() => {
    setMobile(false);
    setMenu(false);
  }, [path]);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("bps-sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const current = groups.flatMap((g) => g.items).find((i) => isActive(i.href));

  const sidebar = (mini: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-slate-100", mini ? "justify-center px-2" : "px-5")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-[11px] font-bold tracking-wide text-white shadow-sm">BPS</div>
        {!mini && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">Admissions CRM</div>
            <div className="truncate text-[11px] text-slate-500">Birla Public School, Kishangarh</div>
          </div>
        )}
      </div>
      <nav className={cn("flex-1 space-y-5 overflow-y-auto py-4", mini ? "px-2" : "px-3")}>
        {groups.map((g) => (
          <div key={g.title}>
            {!mini && <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{g.title}</div>}
            <div className="space-y-0.5">
              {g.items.map((i) => {
                const active = isActive(i.href);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    title={mini ? i.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition",
                      mini ? "justify-center px-0" : "px-3",
                      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r-full bg-brand-600" />}
                    <Icon name={i.icon} className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600")} />
                    {!mini && <span className="flex-1 truncate">{i.label}</span>}
                    {!!i.badge &&
                      (mini ? (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
                      ) : (
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", BADGE[i.badgeTone ?? "blue"])}>{i.badge > 99 ? "99+" : i.badge}</span>
                      ))}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className={cn("border-t border-slate-100", mini ? "p-2" : "p-3")}>
        <div className={cn("flex items-center gap-3 rounded-xl", mini ? "justify-center py-2" : "bg-slate-50 p-2.5")}>
          <Link href="/profile" title={user.name}>
            <Avatar name={user.name} />
          </Link>
          {!mini && (
            <>
              <Link href="/profile" className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">{user.name}</div>
                <div className="truncate text-[11px] text-slate-500">{user.role}</div>
              </Link>
              <form action={logout}>
                <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600" title="Sign out" aria-label="Sign out">
                  <Icon name="logout" className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/80 bg-white transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-64")}>
        {sidebar(collapsed)}
        <button
          onClick={toggle}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-brand-700"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name={collapsed ? "expand" : "collapse"} className="h-3.5 w-3.5" />
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button onClick={() => setMobile(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close menu">
              <Icon name="x" />
            </button>
            {sidebar(false)}
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
            <button onClick={() => setMobile(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <div className="hidden min-w-0 md:block">
              <div className="text-[11px] font-medium text-slate-400">Admissions CRM</div>
              <div className="truncate text-sm font-semibold text-slate-800">{current?.label ?? "Lead details"}</div>
            </div>
            <form
              className="relative ml-auto w-full max-w-md md:ml-8"
              onSubmit={(e) => {
                e.preventDefault();
                const q = new FormData(e.currentTarget).get("q");
                router.push(`/leads?q=${encodeURIComponent(String(q ?? ""))}`);
              }}
            >
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                placeholder="Search parent, child, mobile…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
              />
            </form>
            <div className="ml-auto flex items-center gap-1.5 md:ml-4">
              {canCreate && (
                <Link href="/leads/new" className="btn-primary hidden h-10 rounded-xl sm:inline-flex">
                  <Icon name="plus" className="h-4 w-4" /> New Lead
                </Link>
              )}
              <Link href="/follow-ups" className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Follow-ups due">
                <Icon name="bell" />
                {notifications > 0 && (
                  <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
                    {notifications > 99 ? "99+" : notifications}
                  </span>
                )}
              </Link>
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100" aria-label="Account menu">
                  <Avatar name={user.name} size="h-8 w-8 text-[11px]" />
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <div className="text-sm font-semibold">{user.name}</div>
                      <div className="truncate text-xs text-slate-500">{user.email}</div>
                      <div className="mt-1 inline-block rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">{user.role}</div>
                    </div>
                    <Link href="/profile" className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                      My profile & password
                    </Link>
                    <form action={logout}>
                      <button className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50">Sign out</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
