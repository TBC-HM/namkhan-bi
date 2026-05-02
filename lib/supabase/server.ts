// lib/supabase/server.ts
// Factory shim — Next.js server-action drops expect createClient() factory.
// Project uses a single anon-key client (lib/supabase.ts) for all server reads.
// This wraps it so server actions can call createClient() and chain .schema().
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
export function createClient(): SupabaseClient { return supabase; }
