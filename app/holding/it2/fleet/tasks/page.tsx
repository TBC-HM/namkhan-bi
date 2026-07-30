// IT2 shim (brief it-area-reorg-v1): re-exports the existing cockpit page.
// The page renders inside the IT2 shell. Internal links may still point to
// /holding/it/* until the consolidation pass after PBS approves IT2.
export { default } from '@/app/holding/it/cockpit/tasks/page';
