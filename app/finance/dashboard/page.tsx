// app/finance/dashboard/page.tsx — Finance engine dashboard, real data only.
// Uses public proxies of gl.* views (gl schema isn't exposed via PostgREST).
import EngineDashboard, { type EngineConfig } from "@/components/engine/EngineDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const cfg: EngineConfig = {
  dept_label: "Finance",
  hod_role: "finance_hod",
  hod_display_name: "Intel",
  scope: "USALI 11 · current month",
  kpis: [
    { label: "Total revenue", view: "v_finance_house_summary", column: "total_revenue", format: "usd" },
    { label: "GOP", view: "v_finance_house_summary", column: "gop", format: "usd" },
    { label: "Net income", view: "v_finance_house_summary", column: "net_income", format: "usd" },
    { label: "Dept profit", view: "v_finance_house_summary", column: "total_dept_profit", format: "usd" },
  ],
  panels: [
    {
      title: "House summary · USALI by month",
      view: "v_finance_house_summary",
      columns: [
        { key: "period_yyyymm", label: "Period" },
        { key: "total_revenue", label: "Revenue", format: "usd" },
        { key: "total_dept_profit", label: "Dept profit", format: "usd" },
        { key: "ag_total", label: "A&G", format: "usd" },
        { key: "sales_marketing", label: "Sales+Mkt", format: "usd" },
        { key: "pom", label: "POM", format: "usd" },
        { key: "utilities", label: "Utilities", format: "usd" },
        { key: "gop", label: "GOP", format: "usd" },
        { key: "net_income", label: "Net inc", format: "usd" },
      ],
      order_by: { col: "period_yyyymm", ascending: false },
      limit: 18,
    },
    {
      title: "Budget vs actual · current period",
      view: "v_finance_budget_vs_actual",
      columns: [
        { key: "usali_department", label: "Dept" },
        { key: "usali_subcategory", label: "Subcategory" },
        { key: "actual_usd", label: "Actual", format: "usd" },
        { key: "budget_usd", label: "Budget", format: "usd" },
        { key: "variance_usd", label: "Variance", format: "usd" },
        { key: "variance_pct", label: "Var %", format: "pct" },
      ],
      order_by: { col: "variance_usd", ascending: false },
      limit: 20,
    },
    {
      title: "13-week cash forecast",
      view: "v_finance_cash_forecast",
      columns: [
        { key: "week_start", label: "Week" },
        { key: "iso_week", label: "ISO" },
        { key: "otb_inflow", label: "OTB in", format: "usd" },
        { key: "ar_inflow", label: "AR in", format: "usd" },
        { key: "fixed_outflow", label: "Fixed out", format: "usd" },
        { key: "supplier_outflow", label: "Suppliers", format: "usd" },
        { key: "net_cash_flow", label: "Net", format: "usd" },
      ],
      order_by: { col: "week_idx", ascending: true },
      limit: 13,
    },
    {
      title: "Top suppliers · current month",
      view: "v_finance_top_suppliers",
      columns: [
        { key: "rank_month", label: "#", format: "int" },
        { key: "vendor_name", label: "Vendor" },
        { key: "gross_spend_usd", label: "Spend", format: "usd" },
        { key: "line_count", label: "Lines", format: "int" },
      ],
      order_by: { col: "rank_month", ascending: true },
      limit: 15,
    },
  ],
  chat_route: "/api/cockpit/chat",
};

export default function Page() { return <EngineDashboard cfg={cfg} />; }
