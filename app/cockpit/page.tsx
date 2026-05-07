// PATCH INSTRUCTIONS FOR Code Carla:
// Remove the "cost" tab from the cockpit navigation and all related rendering.
// 
// Changes required in app/cockpit/page.tsx:
// 
// 1. TYPE: Remove "cost" from the Tab union type:
//    BEFORE: type Tab = "chat" | "schedule" | "team" | "logs" | "data" | "knowledge" | "tools" | "cost" | "activity" | "docs" | "deploys";
//    AFTER:  type Tab = "chat" | "schedule" | "team" | "logs" | "data" | "knowledge" | "tools" | "activity" | "docs" | "deploys";
//
// 2. NAV BUTTON: Remove the nav tab button for "cost" (the one labelled "💰 Cost").
//    Look for: onClick={() => setTab("cost")} or similar with "💰 Cost" label. Delete that button element entirely.
//
// 3. PANEL: Remove the cost tab panel render block.
//    Look for: {tab === "cost" && ( ... )} — delete that entire JSX block.
//
// 4. No other changes. npx tsc --noEmit must stay clean.
//
// NOTE: This file is a patch-instruction placeholder. Code Carla must fetch the full
// main branch file, apply the 3 changes above, then commit the result.
// DO NOT commit this placeholder as the actual page.tsx.
// Carla: read the full file from https://raw.githubusercontent.com/TBC-HM/namkhan-bi/main/app/cockpit/page.tsx
// apply the 3 changes, commit full updated file to staging branch, then run_typecheck.
