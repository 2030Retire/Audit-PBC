/**
 * GET /api/auth/session
 * Get current session info
 * Returns user_id, firm_id, role, email, display_name
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No active session',
          },
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user_id: session.user_id,
          firm_id: session.firm_id,
          role: session.role,
          email: session.email,
          display_name: session.display_name,
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Session fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}
