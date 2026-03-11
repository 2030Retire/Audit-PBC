/**
 * GET /api/admin/engagements/[engagementId]/request-items
 * List request items for engagement (firm admin or staff)
 *
 * POST /api/admin/engagements/[engagementId]/request-items
 * Create request item (firm admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { RequestItem } from '@/lib/db/types'
import { RequestItemService } from '@/services/request-items/RequestItemService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  try {
    const { engagementId } = await params
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const requestItems = await RequestItemService.listRequestItems(
      session!.firm_id,
      engagementId,
      undefined,
      100
    )

    return NextResponse.json(
      {
        success: true,
        data: requestItems,
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

    console.error('Request items list error:', error)
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  try {
    const { engagementId } = await params
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const body = await req.json()
    const {
      doc_no,
      item_title,
      item_description,
      required_flag,
      due_date,
      allow_multiple_files,
    } = body

    if (!doc_no || !item_title) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'doc_no and item_title are required',
          },
        },
        { status: 400 }
      )
    }

    const db = getServiceClient()
    const query = new ScopedQuery(db)

    const requestItem = await query.insert<RequestItem>(
      'request_items',
      session!.firm_id,
      {
        engagement_id: engagementId,
        template_item_id: null,
        doc_no,
        item_title,
        item_description: item_description || null,
        required_flag: required_flag ?? true,
        allow_multiple_files: allow_multiple_files ?? false,
        item_status: 'REQUESTED',
        due_date: due_date || null,
      }
    )

    return NextResponse.json(
      {
        success: true,
        data: requestItem,
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
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

    console.error('Request item creation error:', error)
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
