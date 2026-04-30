// lib/currentUser.ts
// Mock current-user lookup. Defaults to the seeded owner (paul@thenamkhan.com).
// Phase 2 (real auth): swap getCurrentUser() to read a session cookie/JWT.
// Rest of the app is unchanged because it only uses CurrentUser shape + role helpers.

import { supabase } from '@/lib/supabase';

export type Role = 'owner' | 'gm' | 'finance' | 'staff';

export interface CurrentUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  initials: string;
}

const FALLBACK_OWNER_EMAIL = 'paul@thenamkhan.com';

const FALLBACK_USER: CurrentUser = {
  id: '00000000-0000-0000-0000-000000000000',
  email: FALLBACK_OWNER_EMAIL,
  display_name: 'Paul Bauer',
  role: 'owner',
  initials: 'PB',
};

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const { data } = await supabase
      .from('app_users')
      .select('id, email, display_name, role, initials')
      .eq('email', FALLBACK_OWNER_EMAIL)
      .eq('active', true)
      .single();
    if (data) return data as CurrentUser;
  } catch { /* fall through */ }
  return FALLBACK_USER;
}

export function canEdit(role: Role, requiredRole: Role): boolean {
  const order: Role[] = ['staff', 'finance', 'gm', 'owner'];
  return order.indexOf(role) >= order.indexOf(requiredRole);
}

export function roleLabel(role: Role): string {
  return ({ owner: 'Owner', gm: 'General Manager', finance: 'Finance', staff: 'Staff' } as const)[role];
}
