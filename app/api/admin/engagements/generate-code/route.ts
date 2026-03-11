/**
 * POST /api/admin/engagements/generate-code
 * Auto-generate engagement code based on firm pattern
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const body = await req.json()
    const { company_id, fiscal_year } = body

    if (!company_id || !fiscal_year) {
      return NextResponse.json(
        { success: false, error: { message: 'company_id and fiscal_year are required' } },
        { status: 400 }
      )
    }

    const db = getServiceClient()

    // 1. Get firm settings (code pattern)
    const { data: settings } = await db
      .from('firm_settings')
      .select('engagement_code_pattern, engagement_seq_per_company')
      .eq('firm_id', session!.firm_id)
      .single()

    const pattern = settings?.engagement_code_pattern || '{COMPANY_CODE}-{YEAR}-{SEQ3}'
    const seqPerCompany = settings?.engagement_seq_per_company ?? true

    // 2. Get company code
    const { data: company } = await db
      .from('companies')
      .select('company_code, company_name')
      .eq('company_id', company_id)
      .eq('firm_id', session!.firm_id)
      .single()

    if (!company) {
      return NextResponse.json(
        { success: false, error: { message: '고객사를 찾을 수 없습니다' } },
        { status: 404 }
      )
    }

    // 3. Get & increment sequence
    const seqCompanyId = seqPerCompany ? company_id : null

    // Upsert sequence record
    const { data: seqData, error: seqError } = await db
      .from('engagement_sequences')
      .upsert(
        {
          firm_id: session!.firm_id,
          company_id: seqCompanyId,
          fiscal_year: parseInt(fiscal_year, 10),
          last_seq: 1,
        },
        {
          onConflict: 'firm_id,company_id,fiscal_year',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single()

    let nextSeq = 1
    if (seqError) {
      // Already exists — increment
      const { data: existingSeq } = await db
        .from('engagement_sequences')
        .select('seq_id, last_seq')
        .eq('firm_id', session!.firm_id)
        .eq('fiscal_year', parseInt(fiscal_year, 10))
        .is(seqPerCompany ? 'company_id' : 'company_id', seqPerCompany ? company_id : null)
        .single()

      if (existingSeq) {
        nextSeq = (existingSeq.last_seq || 0) + 1
        await db
          .from('engagement_sequences')
          .update({ last_seq: nextSeq })
          .eq('seq_id', existingSeq.seq_id)
      }
    } else {
      nextSeq = seqData?.last_seq || 1
    }

    // 4. Build code from pattern
    const year = parseInt(fiscal_year, 10)
    const yearShort = String(year).slice(-2)
    const companyCode = (company.company_code || 'CO').toUpperCase()

    let code = pattern
      .replace('{COMPANY_CODE}', companyCode)
      .replace('{YEAR}', String(year))
      .replace('{YEAR2}', yearShort)
      .replace('{SEQ}', String(nextSeq))
      .replace('{SEQ2}', String(nextSeq).padStart(2, '0'))
      .replace('{SEQ3}', String(nextSeq).padStart(3, '0'))

    return NextResponse.json({
      success: true,
      data: {
        engagement_code: code,
        seq: nextSeq,
        company_code: companyCode,
        fiscal_year: year,
        pattern,
      },
    })
  } catch (error) {
    console.error('Generate engagement code error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
