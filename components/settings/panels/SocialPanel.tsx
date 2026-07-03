// components/settings/panels/SocialPanel.tsx
// PBS 2026-07-03: full CRUD.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, rowStyle, ErrorBanner, LabeledInput, LabeledCheckbox, LabeledTextarea, FormShell, DeleteConfirm, pill } from './_settings_ui';

type Row = { id: number; property_id: number; platform: string; handle: string | null; url: string | null; display_name: string | null; followers: number | null; following: number | null; posts: number | null; active: boolean | null; notes: string | null };
interface Draft { id: number | null; platform: string; handle: string; url: string; display_name: string; followers: string; following: string; posts: string; active: boolean; notes: string; }
const EMPTY: Draft = { id: null, platform: '', handle: '', url: '', display_name: '', followers: '', following: '', posts: '', active: true, notes: '' };
const toDraft = (r: Row): Draft => ({ id: r.id, platform: r.platform ?? '', handle: r.handle ?? '', url: r.url ?? '', display_name: r.display_name ?? '', followers: r.followers?.toString() ?? '', following: r.following?.toString() ?? '', posts: r.posts?.toString() ?? '', active: r.active !== false, notes: r.notes ?? '' });

export default function SocialPanel({ data, propertyId }: { data: Row[]; propertyId: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  function save() {
    if (!draft) return;
    if (!draft.platform.trim()) { setError('Platform is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_social', {
        p_id: draft.id, p_property_id: propertyId,
        p_platform: draft.platform.trim(),
        p_handle: draft.handle.trim() || null,
        p_url: draft.url.trim() || null,
        p_display_name: draft.display_name.trim() || null,
        p_followers: draft.followers ? Number(draft.followers) : null,
        p_following: draft.following ? Number(draft.following) : null,
        p_posts: draft.posts ? Number(draft.posts) : null,
        p_active: draft.active,
        p_notes: draft.notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null); router.refresh();
    });
  }
  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_social', { p_id: id, p_property_id: propertyId });
      if (e) { setError(e.message); return; }
      setConfirmDel(null); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader title="Social" subtitle={`${data.length} account${data.length === 1 ? '' : 's'} · IG · FB · TripAdvisor`}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>} />
      <ErrorBanner error={error} />
      {draft && (
        <FormShell title={draft.id ? 'Edit account' : 'New account'} onSave={save} onCancel={() => { setDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Platform *" value={draft.platform} onChange={(v) => setDraft({ ...draft, platform: v })} placeholder="instagram / facebook / tripadvisor" />
          <LabeledInput label="Handle" value={draft.handle} onChange={(v) => setDraft({ ...draft, handle: v })} placeholder="@namkhan" />
          <LabeledInput label="Display name" value={draft.display_name} onChange={(v) => setDraft({ ...draft, display_name: v })} />
          <LabeledInput label="URL" value={draft.url} onChange={(v) => setDraft({ ...draft, url: v })} type="url" span={3} />
          <LabeledInput label="Followers" value={draft.followers} onChange={(v) => setDraft({ ...draft, followers: v })} type="number" />
          <LabeledInput label="Following" value={draft.following} onChange={(v) => setDraft({ ...draft, following: v })} type="number" />
          <LabeledInput label="Posts" value={draft.posts} onChange={(v) => setDraft({ ...draft, posts: v })} type="number" />
          <LabeledTextarea label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} span={3} />
          <div style={{ gridColumn: '1 / -1' }}>
            <LabeledCheckbox label="Active" checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
          </div>
        </FormShell>
      )}
      {data.length === 0 && !draft ? <EmptyState message="No social accounts yet." /> : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((r) => (
            <div key={r.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{r.platform}</span>
                  {r.handle && <span style={{ fontSize: 12, color: '#5A5A5A' }}>{r.handle}</span>}
                  {r.active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                </div>
                {r.display_name && <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 2 }}>{r.display_name}</div>}
                <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3, display: 'flex', gap: 12 }}>
                  {r.followers != null && <span>{r.followers.toLocaleString('en-US')} followers</span>}
                  {r.posts != null && <span>{r.posts.toLocaleString('en-US')} posts</span>}
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1F3A2E' }}>open ↗</a>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                {confirmDel === r.id ? <DeleteConfirm show busy={busy} onConfirm={() => del(r.id)} onCancel={() => setConfirmDel(null)} /> :
                  <button type="button" onClick={() => setConfirmDel(r.id)} style={btnGhost}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
