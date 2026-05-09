// app/marketing/media/_components/MediaFilterBar.tsx
// Filter strip for the media library: category dropdown + free-text search.
// State is mirrored to URL search params (?cat=…&q=…) so deep-links work.
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

type Option = { value: string; label: string; count: number };

interface Props {
  options: Option[];      // distinct categories present in the data
  total: number;          // total assets across all categories (for "All · N")
}

export default function MediaFilterBar({ options, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const cat = params.get("cat") ?? "";
  const q = params.get("q") ?? "";

  function update(next: { cat?: string; q?: string }) {
    const usp = new URLSearchParams(params.toString());
    const c = next.cat !== undefined ? next.cat : cat;
    const query = next.q !== undefined ? next.q : q;
    if (c) usp.set("cat", c); else usp.delete("cat");
    if (query) usp.set("q", query); else usp.delete("q");
    start(() => router.replace(`${pathname}?${usp.toString()}`));
  }

  const baseInput: React.CSSProperties = {
    fontFamily: "var(--mono)",
    fontSize: "var(--t-xs)",
    letterSpacing: "var(--ls-extra)",
    textTransform: "uppercase",
    color: "var(--ink)",
    background: "var(--paper)",
    border: "1px solid var(--line)",
    padding: "8px 10px",
    height: 34,
    boxSizing: "border-box",
  };

  return (
    <div
      role="search"
      aria-label="Filter media library"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
        opacity: pending ? 0.7 : 1,
        transition: "opacity 120ms",
      }}
    >
      <label
        style={{
          fontFamily: "var(--mono)",
          fontSize: "var(--t-xs)",
          letterSpacing: "var(--ls-extra)",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        Category
        <select
          aria-label="Filter by category"
          value={cat}
          onChange={(e) => update({ cat: e.target.value })}
          style={{ ...baseInput, marginLeft: 8, minWidth: 180 }}
        >
          <option value="">All · {total}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} · {o.count}
            </option>
          ))}
        </select>
      </label>

      <input
        aria-label="Search media"
        type="search"
        placeholder="Search label or description…"
        defaultValue={q}
        onChange={(e) => update({ q: e.target.value })}
        style={{
          ...baseInput,
          textTransform: "none",
          letterSpacing: "normal",
          minWidth: 240,
          flex: "1 1 240px",
          maxWidth: 360,
        }}
      />

      {(cat || q) && (
        <button
          type="button"
          onClick={() => update({ cat: "", q: "" })}
          style={{
            ...baseInput,
            cursor: "pointer",
            color: "var(--brass)",
            background: "transparent",
            borderColor: "var(--line)",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
