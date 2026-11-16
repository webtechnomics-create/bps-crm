import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <div className="text-3xl">🔒</div>
      <h1 className="mt-2 font-semibold">Access denied</h1>
      <p className="mt-1 text-sm text-slate-500">Your role does not have permission to open this page. Ask the Super Admin if you need access.</p>
      <Link href="/dashboard" className="btn-primary mt-4">
        Go to dashboard
      </Link>
    </div>
  );
}
