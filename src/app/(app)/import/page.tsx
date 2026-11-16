import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Importer } from "./importer";

export default async function ImportPage() {
  await requirePermission("lead:import");
  return (
    <div className="max-w-5xl">
      <PageHeader title="Import Leads" subtitle="Upload an Excel sheet saved as CSV (old enquiry register, Meta lead export, etc.). Numbers already in the CRM are skipped as duplicates." />
      <Importer />
    </div>
  );
}
