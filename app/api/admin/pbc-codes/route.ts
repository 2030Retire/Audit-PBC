/**
 * GET  /api/admin/pbc-codes  - List PBC codes (system + firm-specific)
 * POST /api/admin/pbc-codes  - Create firm-specific PBC code
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || undefined
    const includeSystem = searchParams.get('include_system') !== 'false'

    const db = getServiceClient()

    let query = db
      .from('pbc_codes')
      .select('*')
      .eq('is_active', true)
      .order('pbc_category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('pbc_code', { ascending: true })

    // Get system codes AND firm-specific codes
    if (includeSystem) {
      query = query.or(`firm_id.is.null,firm_id.eq.${session!.firm_id}`)
    } else {
      query = query.eq('firm_id', session!.firm_id)
    }

    if (category) {
      query = query.eq('pbc_category', category.toUpperCase())
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('PBC codes list error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const body = await req.json()
    const { pbc_category, pbc_code, pbc_name, pbc_name_en, description, typical_documents, sort_order } = body

    if (!pbc_category || !pbc_code || !pbc_name) {
      return NextResponse.json(
        { success: false, error: { message: 'pbc_category, pbc_code, pbc_name are required' } },
        { status: 400 }
      )
    }

    const db = getServiceClient()
    const { data, error } = await db
      .from('pbc_codes')
      .insert({
        firm_id: session!.firm_id,
        pbc_category: pbc_category.toUpperCase(),
        pbc_code: pbc_code.toUpperCase(),
        pbc_name,
        pbc_name_en: pbc_name_en || null,
        description: description || null,
        typical_documents: typical_documents || null,
        is_system: false,
        sort_order: sort_order || 999,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('PBC code create error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('duplicate')) {
      return NextResponse.json(
        { success: false, error: { message: '이미 존재하는 PBC 코드입니다' } },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
