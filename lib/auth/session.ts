/**
 * JWT Session management
 * Reads firm_id and role from Supabase user_metadata
 * All route handlers must validate session before accessing protected resources
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export type UserRole =
  | 'platform_admin'
  | 'firm_admin'
  | 'firm_staff'
  | 'client'

export interface AppSession {
  user_id: string
  firm_id: string
  company_id: string | null  // 클라이언트 사용자의 소속 고객사 (firm_admin/firm_staff는 null)
  role: UserRole
  email: string
  display_name: string
}

/**
 * Extract and validate session from request cookies
 * Reads role and firm_id from Supabase user_metadata
 */
export async function getSession(
  req: NextRequest
): Promise<AppSession | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: () => {}, // read-only in API routes
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) return null

    const role = (user.user_metadata?.role || 'client') as UserRole
    const firm_id = user.user_metadata?.firm_id || ''
    const company_id = user.user_metadata?.company_id || null

    return {
      user_id: user.id,
      firm_id,
      company_id,
      role,
      email: user.email || '',
      display_name: user.user_metadata?.display_name || user.email || '',
    }
  } catch (error) {
    console.error('Session extraction error:', error)
    return null
  }
}

/**
 * Validate that requester has access to firm
 */
export function assertFirmAccess(
  session: AppSession | null,
  requiredFirmId: string
): asserts session is AppSession {
  if (!session) throw new Error('UNAUTHORIZED: No session')
  if (session.firm_id !== requiredFirmId && session.role !== 'platform_admin') {
    throw new Error('FORBIDDEN: Firm access denied')
  }
}

/**
 * Validate that requester has specific role
 */
export function assertRole(
  session: AppSession | null,
  requiredRoles: UserRole[]
): asserts session is AppSession {
  if (!session) throw new Error('UNAUTHORIZED: No session')
  if (!requiredRoles.includes(session.role)) {
    throw new Error('FORBIDDEN: Insufficient permissions')
  }
}

/**
 * Combined firm and role check
 */
export function assertAccess(
  session: AppSession | null,
  firmId: string,
  requiredRoles: UserRole[]
): asserts session is AppSession {
  assertFirmAccess(session, firmId)
  assertRole(session, requiredRoles)
}
