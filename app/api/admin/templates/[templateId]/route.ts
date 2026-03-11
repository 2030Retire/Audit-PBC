/**
 * GET    /api/admin/templates/[templateId]  - Get template with items
 * DELETE /api/admin/templates/[templateId]  - Deactivate template
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])
    const { templateId } = await params

    const db = getServiceClient()
    const { data, error } = await db
      .from('templates')
      .select('*, template_items(*)')
      .eq('template_id', templateId)
      .eq('firm_id', session!.firm_id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { message: '템플릿을 찾을 수 없습니다' } },
        { status: 404 }
      )
    }

    // Sort items
    if (data.template_items) {
      data.template_items.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])
    const { templateId } = await params

    const db = getServiceClient()
    const { error } = await db
      .from('templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('template_id', templateId)
      .eq('firm_id', session!.firm_id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
