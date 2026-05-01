// app/operations/staff/_components/DqStrip.tsx
"use client";

const META: Record<string, { label: string; tone: string }> = {
  missing_hire_date: {
    label: "Missing hire date",
    tone: "bg-amber-100 text-amber-900 border-amber-300",
  },
  missing_contract: {
    label: "Missing contract PDF",
    tone: "bg-rose-100 text-rose-900 border-rose-300",
  },
  contract_expiring: {
    label: "Contract expiring ≤ 60d",
    tone: "bg-orange-100 text-orange-900 border-orange-300",
  },
  no_payslip_pdf_last_closed_month: {
    label: "Payslip PDF missing",
    tone: "bg-amber-100 text-amber-900 border-amber-300",
  },
  no_calculated_payroll_last_closed_month: {
    label: "Payroll not run",
    tone: "bg-rose-100 text-rose-900 border-rose-300",
  },
};

export function DqStrip({ flags }: { flags: string[] }) {
  if (!flags?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 rounded-sm border border-amber-300 bg-amber-50/60 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-900">
        Data quality
      </span>
      {flags.map((f) => {
        const m = META[f] ?? { label: f, tone: "bg-stone-100 text-stone-700 border-stone-300" };
        return (
          <span
            key={f}
            className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${m.tone}`}
          >
            {m.label}
          </span>
        );
      })}
    </div>
  );
}
