/**
 * GET  /api/admin/settings  - Get firm settings
 * PUT  /api/admin/settings  - Update firm settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'

const DEFAULT_SETTINGS = {
  engagement_code_pattern: '{COMPANY_CODE}-{YEAR}-{SEQ3}',
  engagement_seq_per_company: true,
  default_due_days: 30,
  timezone: 'Asia/Seoul',
  locale: 'ko-KR',
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const db = getServiceClient()
    const { data } = await db
      .from('firm_settings')
      .select('*')
      .eq('firm_id', session!.firm_id)
      .single()

    return NextResponse.json({
      success: true,
      data: data || { firm_id: session!.firm_id, ...DEFAULT_SETTINGS },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const body = await req.json()
    const {
      engagement_code_pattern,
      engagement_seq_per_company,
      default_due_days,
      timezone,
      locale,
    } = body

    const db = getServiceClient()

    // Upsert firm settings
    const { data, error } = await db
      .from('firm_settings')
      .upsert({
        firm_id: session!.firm_id,
        engagement_code_pattern: engagement_code_pattern || DEFAULT_SETTINGS.engagement_code_pattern,
        engagement_seq_per_company: engagement_seq_per_company ?? true,
        default_due_days: default_due_days ?? 30,
        timezone: timezone || 'Asia/Seoul',
        locale: locale || 'ko-KR',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
