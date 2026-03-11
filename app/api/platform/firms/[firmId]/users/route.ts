/**
 * POST /api/platform/firms/[firmId]/users
 * Create a Firm Admin or Staff account
 * Platform admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ firmId: string }> }
) {
  try {
    const { firmId } = await params
    const session = await getSession(req)
    assertRole(session, ['platform_admin'])

    const { email, password, display_name, role } = await req.json()

    if (!email || !password || !role) {
      return NextResponse.json({ success: false, error: { message: 'email, password, role 필수' } }, { status: 400 })
    }
    if (!['firm_admin', 'firm_staff'].includes(role)) {
      return NextResponse.json({ success: false, error: { message: 'role은 firm_admin 또는 firm_staff' } }, { status: 400 })
    }

    // Verify firm exists
    const db = getServiceClient()
    const { data: firm } = await db.from('firms').select('firm_id, firm_name').eq('firm_id', firmId).maybeSingle()
    if (!firm) {
      return NextResponse.json({ success: false, error: { message: '펌을 찾을 수 없습니다' } }, { status: 404 })
    }

    // Use admin client to create user
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        firm_id: firmId,
        display_name: display_name || email,
      },
    })

    if (createError) {
      return NextResponse.json({ success: false, error: { message: createError.message } }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: newUser.user.id,
        email: newUser.user.email,
        role,
        firm_id: firmId,
      },
    }, { status: 201 })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: { message: '권한 없음' } }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ firmId: string }> }
) {
  try {
    const { firmId } = await params
    const session = await getSession(req)
    assertRole(session, ['platform_admin'])

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: { users }, error } = await adminClient.auth.admin.listUsers()
    if (error) throw error

    // Filter users belonging to this firm
    const firmUsers = users
      .filter(u => u.user_metadata?.firm_id === firmId)
      .map(u => ({
        user_id: u.id,
        email: u.email,
        role: u.user_metadata?.role,
        display_name: u.user_metadata?.display_name || u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }))

    return NextResponse.json({ success: true, data: firmUsers })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 })
  }
}
