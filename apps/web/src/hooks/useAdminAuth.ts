import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Session } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/supabase/auth'

interface AdminAuthState {
  session: Session | null
  isAdminUser: boolean
  loading: boolean
}

export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    session: null,
    isAdminUser: false,
    loading: true,
  })

  useEffect(() => {
    // `active` prevents stale state updates after cleanup (React StrictMode runs
    // effects twice in development, which causes two concurrent async flows).
    let active = true

    async function resolveAuth(session: Session | null) {
      try {
        const adminOk = session ? await isAdmin(session.user.id) : false
        if (active) setState({ session, isAdminUser: adminOk, loading: false })
      } catch {
        // isAdmin query failed — treat as unauthenticated so the spinner clears
        if (active) setState({ session: null, isAdminUser: false, loading: false })
      }
    }

    // getSession() reads from localStorage — resolves without a network call when
    // a valid token exists. Adding .catch() ensures loading always clears even if
    // the Supabase client throws (e.g. corrupted storage, missing env vars).
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active) void resolveAuth(session)
      })
      .catch(() => {
        if (active) setState({ session: null, isAdminUser: false, loading: false })
      })

    // Subscribe for subsequent auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED).
    // In supabase-js v2.26+ this also fires INITIAL_SESSION synchronously, which
    // would race with getSession(). Both paths use resolveAuth(), so the first one
    // to complete wins; the active flag stops the slower one from overwriting it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolveAuth(session)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
