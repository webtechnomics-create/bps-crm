import type { LeadSource, LeadStatus } from "@prisma/client";
import { SOURCE_LABEL, STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_COLOR[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const SRC_COLOR: Record<LeadSource, string> = {
  FACEBOOK: "bg-blue-50 text-blue-700",
  INSTAGRAM: "bg-pink-50 text-pink-700",
  GOOGLE_ADS: "bg-yellow-50 text-yellow-800",
  WEBSITE: "bg-emerald-50 text-emerald-700",
  WALK_IN: "bg-slate-100 text-slate-700",
  PHONE: "bg-purple-50 text-purple-700",
  REFERRAL: "bg-lime-50 text-lime-800",
  OTHER: "bg-slate-100 text-slate-600",
};

export function SourceBadge({ source }: { source: LeadSource }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium", SRC_COLOR[source])}>{SOURCE_LABEL[source]}</span>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const t = { default: "text-slate-900", good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600" }[tone];
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", t)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}
