// app/operations/sustainability/_components/SustainabilityClient.tsx
'use client';

import { useState } from 'react';
import DocContainer, { type DocContainerDoc } from '@/app/_components/DocContainer';
import DocPreviewModal from '@/app/_components/DocPreviewModal';

export default function SustainabilityClient({ sections }: { sections: Array<{ key: string; label: string; desc: string; docs: DocContainerDoc[] }> }) {
  const [preview, setPreview] = useState<DocContainerDoc | null>(null);
  return (
    <>
      {sections.map(s => (
        <DocContainer key={s.key} label={s.label} desc={s.desc} docs={s.docs} defaultOpen={s.docs.length > 0 && s.docs.length <= 5} onPreview={setPreview} />
      ))}
      {preview && <DocPreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
