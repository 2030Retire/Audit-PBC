/**
 * GET    /api/admin/users/[userId]  — 사용자 상세
 * DELETE /api/admin/users/[userId]  — 사용자 비활성화 (소프트 삭제)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const db = getServiceClient()
    const { data, error } = await db
      .from('users')
      .select('*, companies(company_id, company_code, company_name)')
      .eq('firm_id', session!.firm_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: '권한이 없습니다' } },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const db = getServiceClient()

    // 대상 사용자 확인 (firm 범위 + 비활성화 대상 확인)
    const { data: targetUser, error: fetchError } = await db
      .from('users')
      .select('user_id, auth_subject, user_type, status')
      .eq('firm_id', session!.firm_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError || !targetUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다' } },
        { status: 404 }
      )
    }

    // platform_admin은 삭제 불가
    if (targetUser.user_type === 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '플랫폼 관리자는 삭제할 수 없습니다' } },
        { status: 403 }
      )
    }

    // Supabase Auth 사용자 비활성화 (ban)
    if (targetUser.auth_subject) {
      await db.auth.admin.updateUserById(targetUser.auth_subject, {
        ban_duration: 'none', // 'none'으로 설정 후 사용자 삭제
      })
      // 실제 삭제
      const { error: deleteAuthError } = await db.auth.admin.deleteUser(targetUser.auth_subject)
      if (deleteAuthError) {
        console.warn('Auth user delete warning:', deleteAuthError.message)
      }
    }

    // users 테이블 소프트 삭제
    const { error: updateError } = await db
      .from('users')
      .update({ status: 'DELETED', updated_at: new Date().toISOString() })
      .eq('firm_id', session!.firm_id)
      .eq('user_id', userId)

    if (updateError) throw updateError

    return NextResponse.json(
      {
        success: true,
        data: { user_id: userId, status: 'DELETED' },
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: '권한이 없습니다' } },
        { status: 403 }
      )
    }
    console.error('Delete user error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
