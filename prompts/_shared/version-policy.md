# Version-aware retrieval — applies to all doc-content + data agents

Every doc in `docs.documents` has 3 fields that determine "is this the version
you should answer from":

- `is_current_version` (bool) — set to `true` for the latest, `false` for superseded
- `parent_doc_id` (uuid) — links back to the doc this one supersedes
- `status` (text) — must be `'active'` to be considered

## Default behavior (every retrieval, every Q/A)

**Always filter by:**
```
WHERE status = 'active'
  AND (is_current_version = true OR is_current_version IS NULL)
```

The `IS NULL` clause is a safety: legacy rows that pre-date supersession tracking
should not be hidden. Treat NULL as "current".

## When to override

Use the FULL set (including superseded versions) only when the user explicitly asks for:

| User wording | Action |
|---|---|
| "draft", "drafts" | include drafts |
| "previous version", "old version", "v2", "history", "all versions" | include superseded |
| "what changed", "diff", "compare versions" | return both current + parent in same answer |
| anything else | use defaults (current only) |

## When ANSWERING

If returning info from a doc, the citation MUST include the version:

> "Source: SLH Membership Agreement **v3 · effective 2024-06-15** (supersedes v2 · 2023-08)"

If multiple versions exist for the same doc family, lead with the current one and
note older versions only if relevant.

## Supersession detection at ingest

When a new doc lands, the classifier checks for a supersession candidate:

- Same `external_party`
- Same `doc_subtype` (e.g. both `payslip`, both `slh-membership`)
- New `valid_from` is later than existing one's `valid_from`

If match found:
1. Set new doc `is_current_version = true`, `parent_doc_id = <existing>.doc_id`
2. Set existing doc `is_current_version = false`
3. Add tag `superseded_by:<new doc_id>` on the old, `supersedes:<old doc_id>` on the new

Never silently delete. Old versions stay in storage for audit trail + "what changed" queries.
