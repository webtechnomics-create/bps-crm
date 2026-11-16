import type { LeadSource, LeadStatus } from "@prisma/client";
import { SOURCE_LABEL, STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Icon } from "./shell";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_COLOR[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
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
  return <span className={cn("inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium", SRC_COLOR[source])}>{SOURCE_LABEL[source]}</span>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const TONE = {
  default: { chip: "bg-brand-50 text-brand-600", value: "text-slate-900" },
  good: { chip: "bg-emerald-50 text-emerald-600", value: "text-slate-900" },
  warn: { chip: "bg-amber-50 text-amber-600", value: "text-slate-900" },
  bad: { chip: "bg-rose-50 text-rose-600", value: "text-slate-900" },
  violet: { chip: "bg-violet-50 text-violet-600", value: "text-slate-900" },
};

/** KPI card. `delta` is a % change vs. the previous period; `goodWhenUp` decides its color. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
  delta,
  goodWhenUp = true,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: keyof typeof TONE;
  icon?: string;
  delta?: number | null;
  goodWhenUp?: boolean;
}) {
  const t = TONE[tone];
  const up = (delta ?? 0) >= 0;
  const good = up === goodWhenUp;
  return (
    <div className="card flex h-full flex-col p-5 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        {icon && (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", t.chip)}>
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tracking-tight tabular-nums", t.value)}>{value}</div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs">
        {delta != null && Number.isFinite(delta) && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold", good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            <Icon name={up ? "arrowUp" : "arrowDown"} className="h-3 w-3" />
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {hint && <span className="text-slate-400">{hint}</span>}
      </div>
    </div>
  );
}

export function CardHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}
