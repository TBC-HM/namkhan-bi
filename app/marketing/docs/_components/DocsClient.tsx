// app/marketing/docs/_components/DocsClient.tsx
// PBS 2026-07-06: uses shared DocContainer primitive (collapsible) + DocPreviewModal.
'use client';

import { useState } from 'react';
import DocContainer, { type DocContainerDoc } from '@/app/_components/DocContainer';
import DocPreviewModal from '@/app/_components/DocPreviewModal';

type SerializedDoc = DocContainerDoc;

type Section = {
  container: { key: string; label: string; desc: string };
  docs: SerializedDoc[];
};

export default function DocsClient({ sections }: { sections: Section[] }) {
  const [preview, setPreview] = useState<SerializedDoc | null>(null);

  return (
    <>
      {sections.map(s => (
        <DocContainer
          key={s.container.key}
          label={s.container.label}
          desc={s.container.desc}
          docs={s.docs}
          defaultOpen={s.docs.length > 0 && s.docs.length <= 10}
          onPreview={setPreview}
        />
      ))}
      {preview && <DocPreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
