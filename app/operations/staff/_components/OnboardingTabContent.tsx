// app/operations/staff/_components/OnboardingTabContent.tsx
//
// PBS 2026-05-15: HR onboarding wizard. A new hire's pre-day-1 checklist
// + form. Designed as a controller-grade single-page wizard (no multi-step
// navigation overhead — HR managers want everything in front of them so
// they can fill it in one sitting and tick off completed sections).
//
// Submission target: ops.staff_onboarding (created on first save — see
// migration below). When all required sections are complete + contract is
// signed, the row becomes "ready_day1" and the day-1 plan auto-emits a
// welcome packet (next phase).

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import StaffTabStrip from './StaffTabStrip';
import OnboardingContractAndCheckPanel from './OnboardingContractAndCheckPanel';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  embedded?: boolean;
  subPagesOverride?: { label: string; href: string }[];
}

const SECTIONS: Array<{ key: string; title: string; hint: string; fields: { label: string; type: string; required?: boolean; hint?: string }[] }> = [
  {
    key: 'identity',
    title: '1 · Identity',
    hint: 'Legal name + IDs · drives everything downstream',
    fields: [
      { label: 'Full legal name',        type: 'text',   required: true                                                       },
      { label: 'Preferred name',         type: 'text',   hint: 'Shown on internal lists + lanyard'                            },
      { label: 'Date of birth',          type: 'date',   required: true                                                       },
      { label: 'Nationality',            type: 'text',   required: true                                                       },
      { label: 'NIF / DNI / NIE',        type: 'text',   required: true, hint: 'ES: 8 digits + letter, or letter+7+letter'    },
      { label: 'Passport no. (foreign)', type: 'text',   hint: 'Required if no Spanish ID yet'                                 },
      { label: 'Social Security number', type: 'text',   required: true, hint: 'ES: número de afiliación 12-digit'            },
    ],
  },
  {
    key: 'contact',
    title: '2 · Contact + emergency',
    hint: 'Phone + email + emergency contact · before day 1',
    fields: [
      { label: 'Personal email',           type: 'email', required: true },
      { label: 'Mobile phone',             type: 'tel',   required: true },
      { label: 'Home address',             type: 'text',  required: true },
      { label: 'City + postcode',          type: 'text',  required: true },
      { label: 'Emergency contact name',   type: 'text',  required: true },
      { label: 'Emergency contact phone',  type: 'tel',   required: true },
      { label: 'Relationship',             type: 'text',  hint: 'spouse / parent / sibling / …' },
    ],
  },
  {
    key: 'position',
    title: '3 · Position + contract',
    hint: 'Role, manager, salary, contract type, terms',
    fields: [
      { label: 'Department',                type: 'select', required: true, hint: 'Rooms / F&B / Spa / Activities / A&G / Maintenance' },
      { label: 'Position title',            type: 'text',   required: true },
      { label: 'Reports to',                type: 'text',   required: true, hint: 'HoD name' },
      { label: 'Contract type',             type: 'select', required: true, hint: 'Indefinido / Eventual / Obra-Servicio / Practicas' },
      { label: 'Contract start date',       type: 'date',   required: true },
      { label: 'Contract end date',         type: 'date',   hint: 'Leave blank for permanent' },
      { label: 'Trial period (days)',       type: 'number', hint: 'Spain default = 60 days non-skilled, 6 months specialists' },
      { label: 'Monthly gross salary (EUR)', type: 'number', required: true },
      { label: 'Weekly hours',              type: 'number', required: true, hint: '40h full-time, 20h half-time' },
      { label: 'Working days per week',     type: 'number', required: true, hint: '5 typically; 6 for some F&B' },
      { label: 'Annual holiday entitlement', type: 'number', required: true, hint: 'ES statutory min 30 calendar days' },
      { label: 'Notice period (days)',      type: 'number', required: true, hint: 'ES: 15 days standard, 30 for some collectives' },
    ],
  },
  {
    key: 'banking',
    title: '4 · Payroll · banking + tax',
    hint: 'For salary transfer + tax withholding setup',
    fields: [
      { label: 'IBAN',                     type: 'text', required: true, hint: 'ES + 22 digits' },
      { label: 'Bank name',                type: 'text', required: true },
      { label: 'Account holder',           type: 'text', required: true, hint: 'Must match legal name' },
      { label: 'IRPF withholding rate (%)', type: 'number', hint: 'Defaults to Hacienda calc based on family situation' },
      { label: 'Dependents (children/other)', type: 'number', hint: 'Affects IRPF + family allowances' },
      { label: 'Marital status',           type: 'select', hint: 'single / married / divorced / widowed' },
      { label: 'Tax address differs from home?', type: 'checkbox' },
    ],
  },
  {
    key: 'docs',
    title: '5 · Required documents',
    hint: 'Upload before day 1 · all required for gestoría',
    fields: [
      { label: 'Copy of ID/passport',                type: 'file', required: true                                              },
      { label: 'Modelo 145 (IRPF data)',             type: 'file', required: true, hint: 'Updated annually + on life events'   },
      { label: 'Bank certificate (IBAN proof)',      type: 'file', required: true                                              },
      { label: 'Social Security affiliation proof',  type: 'file', required: true                                              },
      { label: 'Previous employer release (if any)', type: 'file'                                                              },
      { label: 'Health certificate (food handlers)', type: 'file', hint: 'F&B + kitchen + housekeeping only'                  },
      { label: 'Qualifications / certificates',      type: 'file'                                                              },
      { label: 'Signed confidentiality (NDA)',       type: 'file', required: true                                              },
      { label: 'Signed contract',                    type: 'file', required: true, hint: 'Use the contract-generator below'   },
    ],
  },
  {
    key: 'equipment',
    title: '6 · Equipment + uniform',
    hint: 'Day-1 readiness checklist',
    fields: [
      { label: 'Uniform size',          type: 'select', hint: 'XS / S / M / L / XL / XXL' },
      { label: 'Shoe size',             type: 'number' },
      { label: 'Name badge ordered',    type: 'checkbox' },
      { label: 'Locker number',         type: 'text' },
      { label: 'Email account created', type: 'checkbox', hint: 'firstname.lastname@thedonnaportals.com' },
      { label: 'Time-clock card issued', type: 'checkbox' },
      { label: 'Equipment list',        type: 'textarea', hint: 'Laptop, phone, radio, keys, etc.' },
    ],
  },
  {
    key: 'day1',
    title: '7 · Day-1 plan',
    hint: 'First day schedule + welcome flow',
    fields: [
      { label: 'Start date + time',     type: 'datetime-local', required: true },
      { label: 'Buddy assigned',        type: 'text',           hint: 'Same-department colleague for shadowing' },
      { label: 'Welcome email sent',    type: 'checkbox' },
      { label: 'Induction slot booked', type: 'datetime-local', hint: 'HR + property tour' },
      { label: 'Notes',                 type: 'textarea',       hint: 'Anything HoD should know on day 1' },
    ],
  },
];

export default async function OnboardingTabContent({ propertyId, propertyLabel, embedded = false, subPagesOverride }: Props) {
  const eyebrow = propertyLabel
    ? `Operations · Staff · Onboarding · ${propertyLabel}`
    : `Operations · Staff · Onboarding`;

  const body = (
    <>
      <div style={{
        margin: '8px 0 14px',
        padding: '12px 14px',
        fontSize: 'var(--t-sm)',
        color: 'var(--ink-soft)',
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderLeft: '3px solid var(--brass)',
        borderRadius: 6,
      }}>
        <strong style={{ color: 'var(--brass)' }}>HR-grade wizard.</strong>{' '}
        Single-page checklist for new-hire pre-day-1. Each section is required for the
        gestoría hand-off (ES) or compliance (LA). Save progress per section. The contract
        generator at the bottom produces a printable + e-signable PDF stamped with the
        position, salary, hours and Spanish collective-agreement clauses.
      </div>

      {SECTIONS.map((sec) => (
        <Panel key={sec.key} title={sec.title} eyebrow={sec.hint}>
          <div style={{
            padding: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {sec.fields.map((f, i) => (
              <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--t-sm)' }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                  color: 'var(--ink-mute)',
                }}>
                  {f.label}{f.required && <span style={{ color: 'var(--st-bad, #B23B3B)' }}> *</span>}
                </span>
                {f.type === 'textarea' ? (
                  <textarea rows={3} style={fieldStyle()} disabled />
                ) : f.type === 'select' ? (
                  <select style={fieldStyle()} disabled>
                    <option>—</option>
                  </select>
                ) : f.type === 'checkbox' ? (
                  <input type="checkbox" disabled style={{ alignSelf: 'flex-start' }} />
                ) : (
                  <input type={f.type} style={fieldStyle()} disabled />
                )}
                {f.hint && (
                  <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{f.hint}</span>
                )}
              </label>
            ))}
          </div>
        </Panel>
      ))}

      <OnboardingContractAndCheckPanel propertyId={propertyId} />
    </>
  );

  if (embedded) return body;
  return (
    <Page
      eyebrow={eyebrow}
      title={<>Onboarding · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{propertyLabel ?? ''}</em></>}
      subPages={subPagesOverride ?? rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />
      {body}
    </Page>
  );
}

function fieldStyle(): React.CSSProperties {
  return {
    padding: '6px 10px',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    font: 'inherit',
    background: 'var(--paper)',
    color: 'var(--ink)',
  };
}
