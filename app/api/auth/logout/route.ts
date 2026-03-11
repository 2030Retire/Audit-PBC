/**
 * POST /api/auth/logout
 * Sign out user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/db/client'
import { getSession } from '@/lib/auth/session'
import { auditLog } from '@/lib/utils/auditLogger'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)

    const client = await getSupabaseClient()
    await client.auth.signOut()

    // Audit log
    if (session) {
      await auditLog(
        session.firm_id,
        session.user_id,
        'USER',
        session.user_id,
        'LOGOUT',
        'SUCCESS',
        'User logged out'
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: null,
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}
