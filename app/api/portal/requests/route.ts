/**
 * GET /api/portal/requests
 * List request items for client (from open engagements)
 * Returns request items with engagement information
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { RequestItem, Engagement } from '@/lib/db/types'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertRole(session, ['client'])

    const db = getServiceClient()
    const query = new ScopedQuery(db)

    // Get all open engagements for the firm
    const engagements = await query.select<Engagement>(
      'engagements',
      session!.firm_id,
      { engagement_status: 'OPEN' }
    )

    // Get all request items for these engagements
    const allRequestItems: (RequestItem & {
      engagement_name?: string
      engagement_code?: string
    })[] = []

    for (const engagement of engagements) {
      const items = await query.select<RequestItem>(
        'request_items',
        session!.firm_id,
        { engagement_id: engagement.engagement_id },
        100
      )

      // Add engagement info to each item
      items.forEach((item) => {
        allRequestItems.push({
          ...item,
          engagement_name: engagement.engagement_name,
          engagement_code: engagement.engagement_code,
        })
      })
    }

    // Sort by created_at desc
    allRequestItems.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json(
      {
        success: true,
        data: allRequestItems,
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

    console.error('Portal requests error:', error)
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
