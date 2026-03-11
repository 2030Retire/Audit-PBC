/**
 * POST /api/admin/engagements/[engagementId]/request-items/bulk
 * Bulk create request items (from Excel upload or template apply)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])
    const { engagementId } = await params

    const body = await req.json()
    const { items, template_id, replace_existing } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'items array is required' } },
        { status: 400 }
      )
    }

    const db = getServiceClient()

    // Verify engagement belongs to firm
    const { data: engagement } = await db
      .from('engagements')
      .select('engagement_id, firm_id')
      .eq('engagement_id', engagementId)
      .eq('firm_id', session!.firm_id)
      .single()

    if (!engagement) {
      return NextResponse.json(
        { success: false, error: { message: '감사를 찾을 수 없습니다' } },
        { status: 404 }
      )
    }

    // If replace_existing, delete current items
    if (replace_existing) {
      await db
        .from('request_items')
        .delete()
        .eq('engagement_id', engagementId)
        .eq('firm_id', session!.firm_id)
    }

    // Get existing doc_nos to avoid duplicates
    const { data: existing } = await db
      .from('request_items')
      .select('doc_no')
      .eq('engagement_id', engagementId)
      .eq('firm_id', session!.firm_id)

    const existingDocNos = new Set((existing || []).map((r: { doc_no: string }) => r.doc_no))

    // Build insert rows
    const insertRows = []
    const skipped = []
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      const docNo = (item.doc_no || `ITEM-${String(idx + 1).padStart(3, '0')}`).trim()

      if (existingDocNos.has(docNo)) {
        skipped.push(docNo)
        continue
      }
      existingDocNos.add(docNo)

      insertRows.push({
        firm_id: session!.firm_id,
        engagement_id: engagementId,
        template_item_id: item.template_item_id || null,
        doc_no: docNo,
        item_title: item.item_title || item.title || '',
        item_description: item.item_description || item.description || null,
        required_flag: item.required_flag !== false,
        allow_multiple_files: item.allow_multiple_files || false,
        item_status: 'REQUESTED',
        due_date: item.due_date || null,
        sort_order: item.sort_order || idx + 1,
      })
    }

    if (insertRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { created: 0, skipped: skipped.length, skipped_doc_nos: skipped },
        message: '모든 항목이 이미 존재합니다',
      })
    }

    const { data: created, error } = await db
      .from('request_items')
      .insert(insertRows)
      .select()

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      data: {
        created: created?.length || 0,
        skipped: skipped.length,
        skipped_doc_nos: skipped,
        items: created,
      },
    })
  } catch (error) {
    console.error('Bulk request items error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
