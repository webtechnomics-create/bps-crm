import { prisma } from "@/lib/db";
import { requireUser, leadScope } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { Board } from "./board";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ showClosed?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const since = new Date(Date.now() - 45 * 86400_000);
  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      ...leadScope(u),
      OR: [{ status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } }, ...(sp.showClosed ? [{ updatedAt: { gte: since } }] : [])],
    },
    orderBy: { updatedAt: "desc" },
    take: 600,
    select: { id: true, parentName: true, classApplying: true, status: true, source: true, nextFollowUpAt: true, assignedTo: { select: { name: true } } },
  });
  return (
    <div>
      <PageHeader title="Pipeline Board" subtitle="Drag a card to another column to change its status.">
        <a href={sp.showClosed ? "/board" : "/board?showClosed=1"} className="btn-secondary">
          {sp.showClosed ? "Hide closed" : "Show recent admissions / lost"}
        </a>
      </PageHeader>
      <Board
        canEdit={can(u.role, "lead:edit")}
        showClosed={!!sp.showClosed}
        leads={leads.map((l) => ({ ...l, assignedTo: l.assignedTo?.name ?? null, nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
