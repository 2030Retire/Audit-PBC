/**
 * POST /api/portal/requests/[requestItemId]/comment
 * Add a comment to a request item (portal side)
 * Client comments are always CLIENT_VISIBLE
 * Firm staff can post INTERNAL_ONLY by passing visibility field
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { RequestItemService } from '@/services/request-items/RequestItemService'
import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { RequestItem } from '@/lib/db/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestItemId: string }> }
) {
  try {
    const { requestItemId } = await params
    const session = await getSession(req)
    assertRole(session, ['client', 'firm_admin', 'firm_staff', 'platform_admin'])

    const body = await req.json()
    const { comment_body } = body

    if (!comment_body?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: '코멘트 내용이 없습니다' } },
        { status: 400 }
      )
    }

    const db = getServiceClient()
    const query = new ScopedQuery(db)

    // Get request item to find engagement_id
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

    // Clients always post CLIENT_VISIBLE; firm staff can choose
    const visibility: 'CLIENT_VISIBLE' | 'INTERNAL_ONLY' =
      session!.role === 'client' ? 'CLIENT_VISIBLE' : (body.visibility || 'CLIENT_VISIBLE')

    const comment = await RequestItemService.addComment(
      session!.firm_id,
      requestItem.engagement_id,
      requestItemId,
      session!.user_id,
      comment_body.trim(),
      visibility
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
    console.error('Add comment error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
