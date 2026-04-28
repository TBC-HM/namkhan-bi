import { Section, GreyPlaceholder } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';

export default function ActionsPage() {
  return (
    <div className="pt-6">
      <Section title="Action Plans" tag="Recommendations engine in development" greyed greyedReason="Vertex AI engine — Module 4 of project. Not yet built.">
        <div className="grid grid-cols-5 gap-3 mb-4">
          <Kpi label="Critical" value={null} greyed status="bad" />
          <Kpi label="High Priority" value={null} greyed status="warn" />
          <Kpi label="Opportunities" value={null} greyed />
          <Kpi label="Total Impact" value={null} kind="money" greyed />
          <Kpi label="Resolved 30d" value={null} greyed status="good" />
        </div>
        <div className="text-muted text-sm py-12 text-center">
          Recommendations engine will rank actions by ROI across Revenue, F&B, Spa, Front Office, and Ops/DQ.
        </div>
      </Section>
    </div>
  );
}
