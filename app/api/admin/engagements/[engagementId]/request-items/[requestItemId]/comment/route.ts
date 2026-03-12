/**
 * POST /api/admin/engagements/[engagementId]/request-items/[requestItemId]/comment
 * Add a comment from firm admin/staff side
 * Supports both CLIENT_VISIBLE and INTERNAL_ONLY visibility
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { RequestItemService } from '@/services/request-items/RequestItemService'
import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { RequestItem } from '@/lib/db/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string; requestItemId: string }> }
) {
  try {
    const { requestItemId } = await params
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const body = await req.json()
    const { comment_body, visibility = 'CLIENT_VISIBLE' } = body

    if (!comment_body?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: '코멘트 내용이 없습니다' } },
        { status: 400 }
      )
    }

    const db = getServiceClient()
    const query = new ScopedQuery(db)

    const requestItem = await query.selectOne<RequestItem>(
      'request_items',
      session!.firm_id,
      { request_item_id: requestItemId }
    )

    if (!requestItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '요청 항목을 찾을 수 없습니다' } },
        { status: 404 }
      )
    }

    const comment = await RequestItemService.addComment(
      session!.firm_id,
      requestItem.engagement_id,
      requestItemId,
      session!.user_id,
      comment_body.trim(),
      visibility as 'CLIENT_VISIBLE' | 'INTERNAL_ONLY'
    )

    return NextResponse.json(
      {
        success: true,
        data: comment,
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
    console.error('Admin add comment error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
