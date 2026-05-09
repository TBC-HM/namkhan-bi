// app/marketing/audiences/new/page.tsx
// Marketing · Audiences · New — receives a filter spec from /guest/directory
// (PBS 2026-05-09 JOB 4) and pre-populates an audience preview that mirrors
// the same Supabase reads as the directory page. From here the operator
// either pushes into a campaign or refines further before saving.
//
// Filter spec contract (versioned, v=1):
//   {
//     v: 1,
//     query?: string|null,
//     country?: string|null,
//     sort?: string,                  // e.g. "lifetime_revenue.desc.nullslast"
//     arrival?: "any"|"next_7"|"next_30"|"next_90",
//     stayedSince?: "any"|"30d"|"90d"|"365d"|"730d",
//     repeatOnly?: boolean,
//     contactableOnly?: boolean,
//     generated_at?: string,
//     source?: string,
//   }
//
// Encoding: URL-safe base64 (-/_ instead of +/, padding stripped).

import Link from "next/link";
import Page from "@/components/page/Page";
import { MARKETING_SUBPAGES } from "../../_subpages";
import KpiBox from "@/components/kpi/KpiBox";
import { supabase, PROPERTY_ID } from "@/lib/supabase";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FilterSpec = {
  v?: number;
  query?: string | null;
  country?: string | null;
  sort?: string;
  arrival?: "any" | "next_7" | "next_30" | "next_90";
  stayedSince?: "any" | "30d" | "90d" | "365d" | "730d";
  repeatOnly?: boolean;
  contactableOnly?: boolean;
  generated_at?: string;
  source?: string;
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

const ARRIVAL_BUCKETS: Record<NonNullable<FilterSpec["arrival"]>, string[] | null> = {
  any: null,
  next_7: ["next_7"],
  next_30: ["next_7", "next_30"],
  next_90: ["next_7", "next_30", "next_90"],
};

const STAYED_SINCE_DAYS: Record<NonNullable<FilterSpec["stayedSince"]>, number | null> = {
  any: null,
  "30d": 30,
  "90d": 90,
  "365d": 365,
  "730d": 730,
};

function decodeFilter(b64?: string | string[] | undefined): FilterSpec | null {
  if (!b64 || Array.isArray(b64)) return null;
  try {
    const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
    const json = Buffer.from(pad, "base64").toString("utf8");
    const spec = JSON.parse(json) as FilterSpec;
    return spec;
  } catch {
    return null;
  }
}

export default async function NewAudienceFromGuestFilter({ searchParams }: Props) {
  const spec = decodeFilter(searchParams.from_guest_filter);

  // Build the same query as guest.directory's searchGuests action so the
  // count + preview match exactly what the operator saw before clicking.
  let query = supabase
    .schema("guest")
    .from("mv_guest_profile")
    .select(
      "guest_id, full_name, country, email, phone, stays_count, lifetime_revenue, " +
        "last_stay_date, upcoming_stay_date, days_until_arrival, arrival_bucket, " +
        "top_source, top_segment, is_repeat, marketing_readiness_score",
      { count: "exact" }
    )
    .eq("property_id", PROPERTY_ID);

  if (spec?.query && spec.query.trim().length >= 2) {
    query = query.ilike("full_name", `%${spec.query.trim()}%`);
  }
  if (spec?.country) query = query.eq("country", spec.country);
  if (spec?.repeatOnly) query = query.eq("is_repeat", true);
  if (spec?.contactableOnly) query = query.not("email", "is", null);
  const buckets = spec?.arrival ? ARRIVAL_BUCKETS[spec.arrival] : null;
  if (buckets) query = query.in("arrival_bucket", buckets);
  const days = spec?.stayedSince ? STAYED_SINCE_DAYS[spec.stayedSince] : null;
  if (days) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    query = query.gte("last_stay_date", since);
  }

  // Sort: best-effort; default to LTV desc.
  const sortRaw = spec?.sort || "lifetime_revenue.desc.nullslast";
  const [sortField, sortDir, nullsHint] = sortRaw.split(".");
  query = query.order(sortField, {
    ascending: sortDir === "asc",
    nullsFirst: nullsHint !== "nullslast",
  });

  const { data, count, error } = await query.range(0, 99); // top-100 preview
  const rows = (data as any[]) ?? [];
  const total = count ?? rows.length;

  const matchedLtv = rows.reduce((s, r) => s + Number(r.lifetime_revenue || 0), 0);
  const avgLtv = rows.length > 0 ? matchedLtv / rows.length : 0;
  const addressable = rows.filter((r) => !!r.email).length;

  const filterSummary = summarise(spec);

  return (
    <Page
      eyebrow="Marketing · Audiences · New"
      title={
        <>
          Build an <em style={{ color: "var(--brass)", fontStyle: "italic" }}>audience</em> from the directory
        </>
      }
      subPages={MARKETING_SUBPAGES}
    >
      <div
        style={{
          marginTop: 14,
          padding: "10px 14px",
          background: "var(--paper-deep)",
          border: "1px solid var(--brass-soft, #d8c08b)",
          borderRadius: 6,
          fontSize: "var(--t-sm)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong>Filter spec received from /guest/directory.</strong>{" "}
          {filterSummary}
        </div>
        <Link
          href="/guest/directory"
          style={{
            fontFamily: "var(--mono)",
            fontSize: "var(--t-xs)",
            letterSpacing: "var(--ls-extra)",
            textTransform: "uppercase",
            color: "var(--brass)",
            textDecoration: "none",
          }}
        >
          ← back to directory
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 14,
        }}
      >
        <KpiBox
          value={total}
          unit="count"
          label="Audience size"
          tooltip="Guests matching the filter spec — same logic as /guest/directory."
        />
        <KpiBox value={matchedLtv} unit="usd" label="Total LTV" tooltip="Sum of lifetime_revenue across the matched set (preview top-100)." />
        <KpiBox value={avgLtv} unit="usd" label="Avg LTV / guest" tooltip="matchedLtv ÷ matched count (preview top-100)." />
        <KpiBox
          value={addressable}
          unit="count"
          label="Email addressable"
          tooltip="Subset with email IS NOT NULL — Cloudbeds anonymises today, so this is 0 until enriched-guest sync wires."
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: "var(--t-2xl)",
              color: "var(--ink)",
            }}
          >
            Preview · top {Math.min(rows.length, 100)} of {total.toLocaleString()}
          </h2>
          <Link
            href={`/marketing/campaigns/new${spec?.country ? `?country=${encodeURIComponent(spec.country)}` : ""}`}
            style={{
              padding: "6px 14px",
              fontFamily: "var(--mono)",
              fontSize: "var(--t-xs)",
              letterSpacing: "var(--ls-extra)",
              textTransform: "uppercase",
              fontWeight: 600,
              background: "var(--moss)",
              color: "var(--paper-warm)",
              border: "1px solid var(--moss)",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            + Build campaign from this audience
          </Link>
        </div>

        {error && (
          <div
            style={{
              padding: 14,
              background: "rgba(192,88,76,0.10)",
              border: "1px solid #c0584c",
              borderRadius: 6,
              fontSize: "var(--t-sm)",
              color: "#f5b1ad",
            }}
          >
            Read failed: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <div
            style={{
              padding: 32,
              background: "rgba(255,245,216,0.04)",
              border: "1px solid rgba(168,133,74,0.30)",
              borderRadius: 8,
              textAlign: "center",
              color: "#b8a98a",
              fontStyle: "italic",
            }}
          >
            No guests match this filter spec.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Country</th>
                  <th>Email</th>
                  <th>Source</th>
                  <th style={{ textAlign: "right" }}>Stays</th>
                  <th style={{ textAlign: "right" }}>LTV</th>
                  <th style={{ textAlign: "right" }}>Last stay</th>
                  <th style={{ textAlign: "right" }}>Upcoming</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.guest_id}>
                    <td>
                      <strong>{r.full_name || "—"}</strong>{" "}
                      {r.is_repeat && (
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: "var(--t-xs)",
                            color: "var(--moss)",
                            marginLeft: 6,
                          }}
                        >
                          repeat
                        </span>
                      )}
                    </td>
                    <td className="text-mute">{r.country || "—"}</td>
                    <td className="text-mute">{r.email || "—"}</td>
                    <td className="text-mute">{r.top_source || "—"}</td>
                    <td style={{ textAlign: "right" }}>{r.stays_count}</td>
                    <td style={{ textAlign: "right" }}>{fmtMoney(Number(r.lifetime_revenue || 0), "USD")}</td>
                    <td className="text-mute" style={{ textAlign: "right" }}>{r.last_stay_date || "—"}</td>
                    <td className="text-mute" style={{ textAlign: "right" }}>{r.upcoming_stay_date || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}

function summarise(spec: FilterSpec | null): string {
  if (!spec) return "No filter — this is the full guest base.";
  const parts: string[] = [];
  if (spec.country) parts.push(`country=${spec.country}`);
  if (spec.arrival && spec.arrival !== "any") parts.push(`arrival=${spec.arrival}`);
  if (spec.stayedSince && spec.stayedSince !== "any") parts.push(`stayed_since=${spec.stayedSince}`);
  if (spec.repeatOnly) parts.push("repeat_only");
  if (spec.contactableOnly) parts.push("contactable_only");
  if (spec.query) parts.push(`query="${spec.query}"`);
  if (spec.sort) parts.push(`sort=${spec.sort}`);
  if (parts.length === 0) return "No filter — this is the full guest base.";
  return parts.join(" · ");
}
