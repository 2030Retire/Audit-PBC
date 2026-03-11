/**
 * PUT    /api/admin/pbc-codes/[pbcCodeId]  - Update firm-specific PBC code
 * DELETE /api/admin/pbc-codes/[pbcCodeId]  - Deactivate firm-specific PBC code
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ pbcCodeId: string }> }
) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])
    const { pbcCodeId } = await params

    const body = await req.json()
    const { pbc_name, pbc_name_en, description, typical_documents, sort_order, is_active } = body

    const db = getServiceClient()

    // Verify it belongs to this firm (can't edit system codes)
    const { data: existing } = await db
      .from('pbc_codes')
      .select('firm_id, is_system')
      .eq('pbc_code_id', pbcCodeId)
      .single()

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: '코드를 찾을 수 없습니다' } }, { status: 404 })
    }
    if (existing.is_system || existing.firm_id !== session!.firm_id) {
      return NextResponse.json({ success: false, error: { message: '시스템 코드는 수정할 수 없습니다' } }, { status: 403 })
    }

    const { data, error } = await db
      .from('pbc_codes')
      .update({
        pbc_name,
        pbc_name_en,
        description,
        typical_documents,
        sort_order,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('pbc_code_id', pbcCodeId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pbcCodeId: string }> }
) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])
    const { pbcCodeId } = await params

    const db = getServiceClient()
    const { data: existing } = await db
      .from('pbc_codes')
      .select('firm_id, is_system')
      .eq('pbc_code_id', pbcCodeId)
      .single()

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: '코드를 찾을 수 없습니다' } }, { status: 404 })
    }
    if (existing.is_system || existing.firm_id !== session!.firm_id) {
      return NextResponse.json({ success: false, error: { message: '시스템 코드는 삭제할 수 없습니다' } }, { status: 403 })
    }

    const { error } = await db
      .from('pbc_codes')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('pbc_code_id', pbcCodeId)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
