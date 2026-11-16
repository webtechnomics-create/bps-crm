"use client";
import { useState, useTransition } from "react";
import Papa from "papaparse";
import type { LeadSource } from "@prisma/client";
import { SOURCES, SOURCE_LABEL } from "@/lib/constants";
import { importLeadsAction } from "@/app/actions/import";

const FIELDS: { key: string; label: string; guess: RegExp }[] = [
  { key: "parentName", label: "Parent name *", guess: /parent|father|mother|full.?name|^name$/i },
  { key: "phone", label: "Mobile *", guess: /phone|mobile|contact|whatsapp/i },
  { key: "altPhone", label: "Alternate mobile", guess: /alt|second/i },
  { key: "email", label: "Email", guess: /mail/i },
  { key: "childName", label: "Child name", guess: /child|student|ward/i },
  { key: "classApplying", label: "Class", guess: /class|grade|standard/i },
  { key: "currentSchool", label: "Current school", guess: /school/i },
  { key: "area", label: "Area / city", guess: /area|city|village|address|location/i },
  { key: "transportNeeded", label: "Transport (yes/no)", guess: /transport|bus/i },
  { key: "source", label: "Source", guess: /source|platform/i },
  { key: "campaignName", label: "Campaign", guess: /campaign/i },
  { key: "notes", label: "Notes / remarks", guess: /note|remark|comment|message/i },
  { key: "createdAt", label: "Enquiry date", guess: /date|created|time/i },
];

export function Importer() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [source, setSource] = useState<LeadSource>("OTHER");
  const [autoAssign, setAutoAssign] = useState(true);
  const [result, setResult] = useState<{ created?: number; duplicates?: number; errors?: string[]; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const onFile = (f: File) => {
    setResult(null);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const h = res.meta.fields ?? [];
        setHeaders(h);
        setRows(res.data);
        const m: Record<string, string> = {};
        for (const fl of FIELDS) {
          const hit = h.find((x) => fl.guess.test(x) && !Object.values(m).includes(x));
          if (hit) m[fl.key] = hit;
        }
        setMap(m);
      },
    });
  };

  const mapped = rows.map((r) => Object.fromEntries(FIELDS.filter((f) => map[f.key]).map((f) => [f.key, (r[map[f.key]] ?? "").toString().trim()])));
  const ready = map.parentName && map.phone && rows.length > 0;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <label className="label">1. Choose CSV file</label>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-sm" />
        <p className="mt-2 text-xs text-slate-500">
          In Excel: File → Save As → “CSV UTF-8”. First row must be column headings.{" "}
          <a
            className="text-brand-700 underline"
            href={"data:text/csv;charset=utf-8," + encodeURIComponent("Parent Name,Mobile,Child Name,Class,Area,Source,Notes\nRamesh Sharma,9876543210,Aarav,Class 3,Madanganj,Walk-in,Visited on Sunday\n")}
            download="lead-import-sample.csv"
          >
            Download sample
          </a>
        </p>
      </div>

      {headers.length > 0 && (
        <div className="card p-5">
          <label className="label">2. Match columns ({rows.length} rows found)</label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <span className="text-xs text-slate-600">{f.label}</span>
                <select className="input" value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}>
                  <option value="">— skip —</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <span className="text-xs text-slate-600">Source to use when the sheet has none</span>
              <select className="input" value={source} onChange={(e) => setSource(e.target.value as LeadSource)}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 pt-5 text-sm">
              <input type="checkbox" checked={autoAssign} onChange={(e) => setAutoAssign(e.target.checked)} />
              Auto-assign imported leads to counselors (round robin)
            </label>
          </div>
        </div>
      )}

      {ready && (
        <div className="card overflow-x-auto">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium">3. Preview (first 5 rows)</div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {FIELDS.filter((f) => map[f.key]).map((f) => (
                  <th key={f.key} className="th">
                    {f.label.replace(" *", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mapped.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  {FIELDS.filter((f) => map[f.key]).map((f) => (
                    <td key={f.key} className="td">
                      {r[f.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4">
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setResult(await importLeadsAction(mapped, source, autoAssign));
                })
              }
            >
              {pending ? `Importing ${rows.length} rows…` : `Import ${rows.length} leads`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`card p-5 ${result.error ? "border-rose-200" : "border-emerald-200"}`}>
          {result.error ? (
            <p className="text-rose-700">{result.error}</p>
          ) : (
            <>
              <p className="font-medium text-emerald-700">
                Done: {result.created} new leads created, {result.duplicates} duplicates skipped.
              </p>
              {!!result.errors?.length && (
                <ul className="mt-2 list-inside list-disc text-sm text-rose-600">
                  {result.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
