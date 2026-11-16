import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";

export default async function ProfilePage() {
  const u = await requireUser();
  return (
    <div className="max-w-md">
      <PageHeader title="My Profile" subtitle={`${u.name} · ${u.email} · ${ROLE_LABEL[u.role]}`} />
      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Change password</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
