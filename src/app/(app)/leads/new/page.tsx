import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { LeadForm } from "../lead-form";
import { createLeadAction } from "@/app/actions/leads";

export default async function NewLeadPage() {
  const u = await requirePermission("lead:create");
  const users = can(u.role, "lead:assign")
    ? await prisma.user.findMany({ where: { active: true, role: { in: ["COUNSELOR", "ADMIN", "SUPER_ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : undefined;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add Lead" subtitle="Walk-in, phone enquiry or reference. If the mobile number already exists you will be taken to that lead." />
      <div className="card p-5">
        <LeadForm action={createLeadAction} users={users} />
      </div>
    </div>
  );
}
