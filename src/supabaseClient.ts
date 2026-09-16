import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[arntags] Variables Supabase absentes du build.',
    {
      hasUrl: Boolean(supabaseUrl),
      hasKey: Boolean(supabaseKey),
    },
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://missing-project.supabase.co',
  supabaseKey || 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
