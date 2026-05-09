"use client";

// app/revenue-v2/_components/Shell.tsx
// Top bar: N is the dropdown trigger (arrow next to it). All 9 sub-routes inside.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "../_data";

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/revenue-v2";
  const active = NAV.find((n) => n.href === path) ?? NAV[0];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <div className="rmv2">
      <div className="topbar">
        <div
          className="logo"
          style={{ cursor: "pointer", position: "relative" }}
          onClick={(e) => { e.stopPropagation(); setOpen((s) => !s); }}
        >
          <span className="mark">N</span>
          <span><b>Namkhan</b> · Revenue v2</span>
          <span className="crumb">/ <b>{active.label}</b></span>
          <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 6, color: "var(--accent)" }}>▾</span>

          {open && (
            <div className="pop" style={{ left: 0, right: "auto", top: 44, minWidth: 240 }} onClick={(e) => e.stopPropagation()}>
              <div className="lbl">Revenue v2</div>
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  style={n.href === path ? { color: "var(--accent)" } : undefined}
                >
                  {n.label}
                  <span className="arrow">›</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="top-actions">
          <Link href="/revenue-v2" className="btn cta">
            Workspace
          </Link>
        </div>
      </div>

      {children}
    </div>
  );
}
