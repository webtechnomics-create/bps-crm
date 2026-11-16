import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

const POINTS = [
  ["Every enquiry in one place", "Facebook, Instagram, Google Ads, website and walk-ins land here automatically."],
  ["Never miss a call-back", "Follow-up reminders and overdue alerts for every counselor."],
  ["Know what brings admissions", "Source and campaign reports with cost per admission."],
];

export default async function LoginPage() {
  if (await getUser()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-indigo-600 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xs font-bold text-brand-800">BPS</div>
          <div>
            <div className="font-semibold">Birla Public School</div>
            <div className="text-sm text-brand-100">Kishangarh</div>
          </div>
        </div>
        <div className="relative my-auto max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Admissions, organised.</h1>
          <p className="mt-3 text-brand-100">The admission team&apos;s workspace for leads, calls and follow-ups.</p>
          <ul className="mt-10 space-y-5">
            {POINTS.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm">✓</span>
                <div>
                  <div className="font-medium">{t}</div>
                  <div className="text-sm text-brand-100">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-brand-200">Admissions CRM</div>
      </section>
      <section className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-xs font-bold text-white">BPS</div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mb-8 mt-1 text-sm text-slate-500">Sign in to the Admissions CRM</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
