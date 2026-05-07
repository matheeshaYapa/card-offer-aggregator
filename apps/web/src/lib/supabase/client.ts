import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // In SSG/prerender context env vars may be absent; warn but don't crash.
  if (typeof window !== 'undefined') {
    console.warn(
      '[CardPromo] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
        'Copy apps/web/.env to apps/web/.env.local and fill in your values.',
    )
  }
}

export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
