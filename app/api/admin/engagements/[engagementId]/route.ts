/**
 * GET /api/admin/engagements/[engagementId]
 * Get engagement detail with company and request items (firm admin or staff)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { Engagement, Company, RequestItem } from '@/lib/db/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  try {
    const { engagementId } = await params
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const db = getServiceClient()
    const query = new ScopedQuery(db)

    // Get engagement
    const engagement = await query.selectOne<Engagement>(
      'engagements',
      session!.firm_id,
      { engagement_id: engagementId }
    )

    if (!engagement) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ENGAGEMENT_NOT_FOUND',
            message: `Engagement ${engagementId} not found`,
          },
        },
        { status: 404 }
      )
    }

    // Get company
    const company = await query.selectOne<Company>(
      'companies',
      session!.firm_id,
      { company_id: engagement.company_id }
    )

    // Get request items
    const requestItems = await query.select<RequestItem>(
      'request_items',
      session!.firm_id,
      { engagement_id: engagementId },
      100
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          engagement,
          company,
          request_items: requestItems,
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

    console.error('Engagement detail error:', error)
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
