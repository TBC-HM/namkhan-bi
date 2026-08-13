paths: .github/**, scripts/**, package.json, vercel.json, next.config.js

# Deploy & push rules

Push protocol (every push, no exceptions):
1. Push via the deploy_github skill (fn_gh_deploy_file) — never raw fn_gh_push_file (the skill carries the prior-push verification gate).
2. After EVERY push: read net._http_response for the request id, then fn_gh_check_build_status(sha) until conclusion=success. in_progress is not a verdict. On failure: read annotations, fix — do NOT push the next file.
3. A 200 is not a landed push: report only push_ledger.verified = true (md5 re-read). verified IS NULL = unproven.
4. Hot shared files (governance.push_hot_files) require fn_gh_declare_read CAS. Never push a file not re-fetched from main in the same turn.
5. Shrink guard: pushes <60% of governance.file_size_baseline are refused — legitimate shrink needs a push_shrink_waivers row first. Never assemble a file across turns without expected_chunks + total_md5.

Merge / deploy gates:
- Green-main gate: no auto-merge while the latest main deployment is not Ready.
- vercel deploy / vercel --prod: BANNED (permissions.deny blocks it).
- Vercel prod builds ignore TS + lint (next.config.js "temp" 2026-05) — tsc --noEmit locally + typecheck.yml are the only type gates.
- design-doc-check runs on PRs only and is non-blocking; do not treat it as a gate that protects anything.

Builders:
- Turn budget binds on WORK per slice, not chars — count steps when slicing.
- Oversized briefs (>12,000 chars) are flagged needs_slice, never dispatched, never "ask the owner to raise the budget".
- NEVER insert into governance.path_approvals to unblock yourself — protected-path pushes need an owner row in protected_path_decisions first.
