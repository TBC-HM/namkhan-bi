"use client";

/**
 * FinanceAskBox — "Ask anything" entry for the Finance pillar.
 *
 * Pattern: mirrors /revenue-v2 AskBox shell.
 * NLP backend: TODO — revenue-v2 orchestrator needs Finance-domain intent scope
 * extension before this routes to a real backend. Currently stubs with static
 * suggestions; form submit logs to console in dev.
 *
 * Sub-ticket: extend orchestrator to Finance domain (target_role: backend, skill: nlp_scope_extend)
 */

import { useState } from "react";

const SUGGESTIONS = [
  "What is our P&L for this month vs budget?",
  "Show me the 13-week cash forecast",
  "Which USALI departments are over budget?",
  "What are our top 5 suppliers by spend this quarter?",
  "What is the current FX rate and how does it affect our USD reporting?",
  "Are there any unmapped transactions?",
];

export default function FinanceAskBox() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    // TODO: route to NLP orchestrator once Finance domain intent is supported.
    // See: KB #284 / revenue-v2 orchestrator scope extension sub-ticket.
    console.debug("[FinanceAskBox] query submitted (stub):", query);
    setSubmitted(true);
  }

  function handleSuggestion(s: string) {
    setQuery(s);
    setSubmitted(false);
  }

  return (
    <div className="ask-box">
      <form onSubmit={handleSubmit} className="ask-form">
        <input
          type="text"
          className="ask-input"
          placeholder="Ask anything about Finance — P&L, cash, budget variance, suppliers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Finance question"
        />
        <button type="submit" className="ask-btn" disabled={!query.trim()}>
          Ask
        </button>
      </form>

      {submitted && (
        <p className="ask-pending" role="status">
          Finance NLP routing is pending scope extension.{" "}
          <span style={{ color: "var(--color-text-muted)" }}>
            See sub-ticket: extend orchestrator to Finance domain.
          </span>
        </p>
      )}

      <div className="ask-suggestions" aria-label="Suggested queries">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="ask-chip"
            type="button"
            onClick={() => handleSuggestion(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <style jsx>{`
        .ask-box {
          background: var(--color-surface-1, #1a1f1e);
          border: 1px solid var(--color-border, #2a2f2e);
          border-radius: 10px;
          padding: var(--space-5, 20px);
          display: flex;
          flex-direction: column;
          gap: var(--space-3, 12px);
        }
        .ask-form {
          display: flex;
          gap: var(--space-2, 8px);
        }
        .ask-input {
          flex: 1;
          background: var(--color-surface-2, #242a29);
          border: 1px solid var(--color-border, #2a2f2e);
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 0.9rem;
          color: var(--color-text-primary, #f5f2ef);
          outline: none;
          transition: border-color 0.15s;
        }
        .ask-input:focus {
          border-color: var(--color-finance, #084838);
        }
        .ask-input::placeholder {
          color: var(--color-text-muted, #6b7280);
        }
        .ask-btn {
          background: var(--color-finance, #084838);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 10px 20px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .ask-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .ask-btn:not(:disabled):hover {
          opacity: 0.85;
        }
        .ask-pending {
          font-size: 0.82rem;
          color: var(--color-warning, #f59e0b);
          margin: 0;
        }
        .ask-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2, 8px);
        }
        .ask-chip {
          background: var(--color-surface-2, #242a29);
          border: 1px solid var(--color-border, #2a2f2e);
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 0.78rem;
          color: var(--color-text-secondary, #9ca3af);
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          text-align: left;
        }
        .ask-chip:hover {
          background: var(--color-finance, #084838);
          color: #fff;
          border-color: transparent;
        }
      `}</style>
    </div>
  );
}
