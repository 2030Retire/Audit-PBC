/**
 * Server-side Supabase client for Server Components and Server Actions
 * Use this in layouts, pages, and server actions that need auth
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // read-only context (Server Components) — ignore
          }
        },
      },
    }
  )
}

/**
 * Get the current user or redirect to /login
 * Use this in protected layouts and pages
 */
export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return user
}

/**
 * Get the current user's role from metadata
 * Returns null if not logged in
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return {
    id: user.id,
    email: user.email ?? '',
    role: (user.user_metadata?.role ?? 'client') as string,
    firm_id: (user.user_metadata?.firm_id ?? '') as string,
    display_name: (user.user_metadata?.display_name ?? user.email ?? '') as string,
  }
}

/**
 * Require auth AND specific role — redirects to /login or /unauthorized
 */
export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth()
  const role = user.user_metadata?.role ?? 'client'

  if (!allowedRoles.includes(role)) {
    redirect('/login')
  }

  return user
}
