"use client";

/**
 * FinanceUsaliAccordion — USALI 11th Edition Department P&L accordion.
 *
 * USALI 11th Edition Department Structure (per KB #246, #247, #248):
 *   Operating Departments:
 *     S1 — Rooms
 *     S2 — Food & Beverage
 *     S3 — Spa (if applicable)
 *     S4 — Other Operated Departments
 *   Undistributed Operating Expenses:
 *     U1 — Administrative & General
 *     U2 — Information & Telecommunications
 *     U3 — Sales & Marketing
 *     U4 — Property Operations & Maintenance
 *     U5 — Utilities
 *   Non-Operating Income & Expense:
 *     N1 — Management Fees
 *     N2 — Rent & Other Income/Expense
 *   Fixed Charges:
 *     F1 — Insurance
 *     F2 — Interest
 *     F3 — Depreciation & Amortization
 *     F4 — Income Taxes
 *
 * Source: mv_revenue_by_usali_dept JOIN cost tables (NOT YET CONFIRMED → all em-dash)
 * Currency: $ USD primary, ₭ LAK secondary
 *
 * REVIEW REQUIRED: Pia + finance_hod (Intel) must verify this department tree mapping
 * is correct for The Namkhan before merge. Flag if any USALI schedule assignment is wrong.
 *
 * TODO: wire to mv_revenue_by_usali_dept once view is built and allowlisted.
 */

import { useState } from "react";
import { EMPTY } from "@/lib/format";

interface UsaliDept {
  code: string;
  name: string;
  type: "operating" | "undistributed" | "non_operating" | "fixed";
  revenue?: string;
  cost?: string;
  profit?: string;
  variance?: string;
  varianceDir?: "up" | "down" | "flat";
}

const USALI_DEPTS: UsaliDept[] = [
  // Operating Departments
  { code: "S1", name: "Rooms", type: "operating" },
  { code: "S2", name: "Food & Beverage", type: "operating" },
  { code: "S3", name: "Spa & Wellness", type: "operating" },
  { code: "S4", name: "Other Operated Departments", type: "operating" },
  // Undistributed
  { code: "U1", name: "Administrative & General", type: "undistributed" },
  { code: "U2", name: "Information & Telecommunications", type: "undistributed" },
  { code: "U3", name: "Sales & Marketing", type: "undistributed" },
  { code: "U4", name: "Property Operations & Maintenance", type: "undistributed" },
  { code: "U5", name: "Utilities", type: "undistributed" },
  // Non-Operating
  { code: "N1", name: "Management Fees", type: "non_operating" },
  { code: "N2", name: "Rent & Other Income / Expense", type: "non_operating" },
  // Fixed Charges
  { code: "F1", name: "Insurance", type: "fixed" },
  { code: "F2", name: "Interest Expense", type: "fixed" },
  { code: "F3", name: "Depreciation & Amortisation", type: "fixed" },
  { code: "F4", name: "Income Taxes", type: "fixed" },
];

const GROUP_LABELS: Record<UsaliDept["type"], string> = {
  operating: "Operating Departments",
  undistributed: "Undistributed Operating Expenses",
  non_operating: "Non-Operating Income & Expense",
  fixed: "Fixed Charges",
};

type GroupType = UsaliDept["type"];

export default function FinanceUsaliAccordion() {
  const [openGroups, setOpenGroups] = useState<Set<GroupType>>(
    new Set(["operating"])
  );

  function toggle(type: GroupType) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const groups = (["operating", "undistributed", "non_operating", "fixed"] as GroupType[]).map(
    (type) => ({
      type,
      label: GROUP_LABELS[type],
      depts: USALI_DEPTS.filter((d) => d.type === type),
    })
  );

  return (
    <div className="accordion">
      {groups.map((group) => {
        const isOpen = openGroups.has(group.type);
        return (
          <div key={group.type} className="accordion-group">
            <button
              className="accordion-header"
              onClick={() => toggle(group.type)}
              aria-expanded={isOpen}
            >
              <span className="accordion-label">{group.label}</span>
              <span className="accordion-toggle" aria-hidden>
                {isOpen ? "▲" : "▼"}
              </span>
            </button>

            {isOpen && (
              <div className="accordion-body">
                <table className="dept-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Department</th>
                      <th className="num">Revenue (USD)</th>
                      <th className="num">Cost (USD)</th>
                      <th className="num">GOP / Net (USD)</th>
                      <th className="num">Budget Var %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.depts.map((dept) => (
                      <tr key={dept.code}>
                        <td className="code-cell">{dept.code}</td>
                        <td>{dept.name}</td>
                        {/* All em-dash until canonical views are wired */}
                        <td className="num" title="Source: mv_revenue_by_usali_dept — pending">
                          {dept.revenue ?? EMPTY}
                        </td>
                        <td className="num" title="Source: cost feed — status unknown">
                          {dept.cost ?? EMPTY}
                        </td>
                        <td className="num" title="GOPPAR formula: GOP / Rooms Available — em-dash if cost null">
                          {dept.profit ?? EMPTY}
                        </td>
                        <td className="num" title="Source: v_finance_budget_vs_actual — pending">
                          {dept.variance ?? EMPTY}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <p className="review-notice" role="note">
        ⚠ USALI department tree mapping requires review by Pia + finance_hod (Intel) before merge.
        Verify schedule assignments match The Namkhan chart of accounts.
      </p>

      <style jsx>{`
        .accordion {
          border: 1px solid var(--color-border, #2a2f2e);
          border-radius: 8px;
          overflow: hidden;
        }
        .accordion-group + .accordion-group {
          border-top: 1px solid var(--color-border, #2a2f2e);
        }
        .accordion-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--color-surface-1, #1a1f1e);
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
        }
        .accordion-header:hover {
          background: var(--color-surface-2, #242a29);
        }
        .accordion-label {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-secondary, #9ca3af);
        }
        .accordion-toggle {
          font-size: 0.65rem;
          color: var(--color-text-muted, #6b7280);
        }
        .accordion-body {
          overflow-x: auto;
          background: var(--color-surface-0, #141918);
        }
        .dept-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .dept-table th {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-muted, #6b7280);
          padding: 8px 12px;
          border-bottom: 1px solid var(--color-border, #2a2f2e);
          text-align: left;
          white-space: nowrap;
        }
        .dept-table th.num,
        .dept-table td.num {
          text-align: right;
        }
        .dept-table td {
          padding: 9px 12px;
          color: var(--color-text-primary, #f5f2ef);
          border-bottom: 1px solid var(--color-border-subtle, #1f2524);
        }
        .dept-table tr:last-child td {
          border-bottom: none;
        }
        .code-cell {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          color: var(--color-finance, #084838);
          font-weight: 700;
        }
        .review-notice {
          font-size: 0.75rem;
          color: var(--color-warning, #f59e0b);
          padding: 10px 16px;
          margin: 0;
          background: var(--color-surface-1, #1a1f1e);
          border-top: 1px solid var(--color-border, #2a2f2e);
        }
      `}</style>
    </div>
  );
}
