/**
 * POST /api/auth/login
 * Initiate OAuth/OIDC login flow or local authentication
 * Redirects to auth provider or returns session on success
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/db/client'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email and password required',
          },
        },
        { status: 400 }
      )
    }

    const client = await getSupabaseClient()

    // Use Supabase auth
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: error.message,
          },
        },
        { status: 401 }
      )
    }

    // Successful login
    return NextResponse.json(
      {
        success: true,
        data: {
          user_id: data.user.id,
          email: data.user.email,
          session: data.session?.access_token,
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login error:', error)
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
