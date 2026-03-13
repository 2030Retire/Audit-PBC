/**
 * GET  /api/admin/users  — firm의 전체 사용자 목록 (+ company 정보)
 * POST /api/admin/users  — 새 클라이언트 사용자 생성 (임시 비밀번호 방식)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'
import { AppUser } from '@/lib/db/types'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// ── GET: 사용자 목록 ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const db = getServiceClient()

    // users 테이블에서 firm 전체 사용자 조회 (company 정보 포함)
    const { data, error } = await db
      .from('users')
      .select(`
        *,
        companies (
          company_id,
          company_code,
          company_name
        )
      `)
      .eq('firm_id', session!.firm_id)
      .neq('status', 'DELETED')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(
      {
        success: true,
        data: data || [],
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
    console.error('List users error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}

// ── POST: 클라이언트 사용자 생성 ──────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const body = await req.json()
    const { email, display_name, company_id } = body

    if (!email || !display_name || !company_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'email, display_name, company_id는 필수입니다',
          },
        },
        { status: 400 }
      )
    }

    const db = getServiceClient()

    // 고객사 검증
    const { data: company, error: companyError } = await db
      .from('companies')
      .select('company_id, company_name')
      .eq('firm_id', session!.firm_id)
      .eq('company_id', company_id)
      .maybeSingle()

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '고객사를 찾을 수 없습니다' } },
        { status: 404 }
      )
    }

    // 이메일 중복 확인 (firm 내)
    const { data: existingUser } = await db
      .from('users')
      .select('user_id')
      .eq('firm_id', session!.firm_id)
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_EMAIL', message: '이미 등록된 이메일입니다' } },
        { status: 409 }
      )
    }

    // 임시 비밀번호 생성
    const tempPassword = generateTempPassword()

    // Supabase Auth: 사용자 생성 (admin API)
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,  // 이메일 인증 생략 (임시 비밀번호 방식)
      user_metadata: {
        role: 'client',
        firm_id: session!.firm_id,
        company_id: company_id,
        display_name: display_name,
      },
    })

    if (authError || !authData.user) {
      console.error('Auth createUser error:', authError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AUTH_ERROR', message: authError?.message || '사용자 생성 실패' },
        },
        { status: 500 }
      )
    }

    // users 테이블에 레코드 생성
    const { data: userRecord, error: userError } = await db
      .from('users')
      .insert({
        firm_id: session!.firm_id,
        company_id: company_id,
        email: email.toLowerCase(),
        display_name: display_name,
        user_type: 'CLIENT_USER',
        auth_provider: 'SUPABASE',
        auth_subject: authData.user.id,
        status: 'ACTIVE',
      })
      .select()
      .single()

    if (userError) {
      // 롤백: auth user 삭제
      await db.auth.admin.deleteUser(authData.user.id)
      console.error('Insert user record error:', userError)
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'DB 저장 실패' } },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: userRecord as AppUser,
          temp_password: tempPassword,  // 관리자에게 1회 노출
          company_name: company.company_name,
        },
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: '권한이 없습니다' } },
        { status: 403 }
      )
    }
    console.error('Create user error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
