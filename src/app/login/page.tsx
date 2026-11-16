import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { SCHOOL_NAME } from "@/lib/constants";

export default async function LoginPage() {
  if (await getUser()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">BPS</div>
          <h1 className="text-lg font-semibold">Admissions CRM</h1>
          <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
