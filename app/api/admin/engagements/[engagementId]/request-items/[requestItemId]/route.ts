/**
 * GET /api/admin/engagements/[engagementId]/request-items/[requestItemId]
 * Get request item detail with comments (firm admin or staff)
 *
 * PATCH /api/admin/engagements/[engagementId]/request-items/[requestItemId]
 * Update request item status (firm admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { RequestItemService, RequestItemStatus } from '@/services/request-items/RequestItemService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string; requestItemId: string }> }
) {
  try {
    const { requestItemId } = await params
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const requestItem = await RequestItemService.getRequestItem(
      session!.firm_id,
      requestItemId
    )

    if (!requestItem) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'REQUEST_ITEM_NOT_FOUND',
            message: `Request item ${requestItemId} not found`,
          },
        },
        { status: 404 }
      )
    }

    // Get all comments (internal access)
    const comments = await RequestItemService.getAllComments(
      session!.firm_id,
      requestItemId,
      100
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          request_item: requestItem,
          comments,
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions',
          },
        },
        { status: 403 }
      )
    }

    console.error('Request item detail error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string; requestItemId: string }> }
) {
  try {
    const { requestItemId } = await params
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const body = await req.json()
    const { item_status, comment_body } = body

    if (!item_status) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'item_status is required',
          },
        },
        { status: 400 }
      )
    }

    // Update status
    const updated = await RequestItemService.updateStatus(
      session!.firm_id,
      requestItemId,
      item_status as RequestItemStatus,
      session!.user_id,
      session!.user_id
    )

    // Add comment if provided
    if (comment_body) {
      await RequestItemService.addComment(
        session!.firm_id,
        updated.engagement_id,
        requestItemId,
        session!.user_id,
        comment_body,
        'INTERNAL_ONLY'
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: updated,
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions',
          },
        },
        { status: 403 }
      )
    }

    console.error('Request item update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
      { status: 500 }
    )
  }
}
