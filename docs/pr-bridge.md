# GitHub PR bridge (gh-pr-bridge-v1 · ADR-180/ADR-202 · live 2026-07-30)

Agent builds can now ship as reviewable pull requests instead of pushing direct to main.

## Functions (public schema, SECURITY DEFINER, ledgered, pg_net two-phase)
| Function | What it does |
|---|---|
| `fn_gh_create_branch(owner, repo, branch, base:='main')` | Creates `refs/heads/<branch>` at live base head. |
| `fn_gh_push_file(owner, repo, BRANCH, path, content, message)` | Existing push — branch arg always existed; works on feature branches with declare-read/CAS intact. |
| `fn_gh_open_pr(owner, repo, head, title, body:='', base:='main')` | Opens a PR, returns pr_number + pr_url. |
| `fn_gh_bridge_result(request_id)` | Second-phase reader: the REAL outcome of any dispatch (rule 531 — responses land post-commit; the in-transaction `ok:true` means dispatched, not landed). |

## Flow for a merge-gated change
1. `SELECT fn_gh_create_branch('TBC-HM','namkhan-bi','build/<brief-slug>');`
2. Push each file with branch `build/<brief-slug>` (hot-file declare-read discipline unchanged).
3. `SELECT fn_gh_open_pr('TBC-HM','namkhan-bi','build/<brief-slug>', '<title>', '<body>');`
4. Verify every step with `fn_gh_bridge_result(<request_id>)` — never trust dispatch-ok alone (2026-07-30 branch-race lesson: a ledger-ok push was silently dropped; content-diff or bridge_result is the truth).
5. PBS merges with one click (or ADR-175 tiered auto-merge for non-protected classes).

## Failure surfacing (bug #89 law)
GitHub 409/422 are returned verbatim by the edge function and readable via `fn_gh_bridge_result` (e.g. `422 Reference already exists` on duplicate branch).

Dry-run evidence: PR #366 (branch `build/gh-pr-bridge-dryrun`, 2 files, close-without-merge).
