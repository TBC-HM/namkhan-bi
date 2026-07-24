// lib/brain/taxonomy.ts
// BRAIN v2 · single source for the doc_kind taxonomy + entity codes.
// Mirrors the active brain.classifier_knowledge pack (v2). When adding a kind:
// 1) edit the knowledge pack via the Brain console rules panel (or fn_brain_rules_update),
// 2) add it here, 3) ship. The classifier coerces unknown kinds to 'other'.

export const BRAIN_DOC_KINDS = [
  'dmc_contract', 'ota_agreement', 'supplier_contract', 'employment_doc', 'insurance_policy',
  'license_permit', 'tax_doc', 'corporate_legal', 'litigation_legal', 'land_property_doc',
  'loan_banking_doc', 'bank_statement', 'financial_statement', 'invoice_receipt',
  'certification_audit', 'sustainability_esg', 'market_research', 'platform_tech_doc',
  'template_form', 'official_correspondence', 'procurement_catalog', 'sop_source',
  'factsheet', 'brand_asset_doc', 'partner_marketing', 'meeting_note_memo', 'other',
] as const;

export const BRAIN_ENTITIES = [
  'green_tea', 'pll', 'namkhan_group', 'namkhan_ag', 'donna',
  'owner_personal', 'multiple', 'external', 'unknown',
] as const;

export const BRAIN_TIERS = ['staff_ok', 'management', 'owner_only', 'legal_confidential'] as const;

export type BrainDocKind = (typeof BRAIN_DOC_KINDS)[number];
export type BrainEntity = (typeof BRAIN_ENTITIES)[number];
export type BrainTier = (typeof BRAIN_TIERS)[number];
