//
// How is this obligation actually discharged? The Standard measured all 2,164
// against one question — "is there an SOP?" — which is a category error for most
// of them. Demanding an SOP for "You felt safe and secure at all times during the stay"
// cannot succeed; that is an inspector's verdict, not a procedure.
//
// RULES ARE ORDERED MOST-SPECIFIC-FIRST and the order is load-bearing, exactly as in
// deptMap.ts. The mystery-inspection rule must precede every category rule, because
// those requirements carry service/cleanliness/brand categories and would otherwise be
// classified as procedures.

export type DischargeMode = 'procedure' | 'rule' | 'evidence' | 'observation';

export interface DischargeInput {
  authority: string;
  sourceTitle: string;
  category: string | null;
  text: string;
}

// "shall not", "never", "must not", "is prohibited", "only <role> may"
const PROHIBITION = /\b(shall not|must not|never|may not|is prohibited|are prohibited|do not|owner-only)\b/i;

// A thing you hold and can show: a document, a record, a register, a goal on paper.
const EVIDENCE_WORDS =
  /\b(document|documented|record|recorded|register|registry|list|policy|policies|plan|certificate|certification|report|goals?|written|in writing|evidence|log|displayed|published|available (?:to|for) (?:guests|public)|awareness of)\b/i;

// Authorities whose corpus is overwhelmingly "hold proof of this", not "do this".
const EVIDENCE_AUTHORITIES = new Set(['GSTC', 'Travelife', 'Sustainability', 'ASEAN', 'Legal']);

// Categories that describe a repeatable act someone performs.
const PROCEDURE_CATEGORIES = new Set([
  'service', 'cleanliness', 'service_operations', 'product', 'safety',
]);

export function dischargeModeFor(input: DischargeInput): DischargeMode {
  const text = (input.text || '').trim();
  const title = (input.sourceTitle || '').trim();
  const category = (input.category || '').trim();
  const authority = (input.authority || '').trim();

  // 1. A mystery inspection records what an inspector EXPERIENCED. Uniformly past
  //    tense and second person ("You were respectfully addressed by your name").
  //    Source-level, not wording-level: the wording is consistent enough that a
  //    regex on tense would only add false negatives.
  if (/mystery inspection/i.test(title)) return 'observation';

  // 2. A prohibition is a standing rule wherever it appears — it outranks the
  //    authority default, so "shall not misuse the certification logo" in a
  //    sustainability source is a rule, not a document to file.
  if (PROHIBITION.test(text)) return 'rule';

  // 3. Brand obligations are constraints on how we present ourselves.
  if (category === 'brand') return 'rule';

  // 4. Preventive maintenance is scheduled work, always.
  if (authority === 'PM') return 'procedure';

  // 5. Categories that name an act.
  if (PROCEDURE_CATEGORIES.has(category)) return 'procedure';

  // 6. Compliance-family authorities: a document unless it named an act above.
  if (EVIDENCE_AUTHORITIES.has(authority)) return 'evidence';

  // 7. Anything else that talks like paperwork.
  if (EVIDENCE_WORDS.test(text)) return 'evidence';

  // 8. Default to the mode that ASKS THE MOST. A wrong `procedure` shows a HoD an
  //    Activate CTA they can dismiss; a wrong `evidence` silently excuses a real
  //    procedure from ever needing an SOP.
  return 'procedure';
}
