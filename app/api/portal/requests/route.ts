/**
 * GET /api/portal/requests
 * List request items for the logged-in portal user
 * - client: filtered by their company_id (from user_metadata)
 * - firm_admin/firm_staff: all firm's request items (for preview/testing)
 * Returns request items with engagement information, sorted by urgency
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'
import { RequestItem, Engagement } from '@/lib/db/types'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertRole(session, ['client', 'firm_admin', 'firm_staff', 'platform_admin'])

    const db = getServiceClient()
    const isClient = session!.role === 'client'

    // Client users with no company assigned → empty list
    if (isClient && !session!.company_id) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
        },
        { status: 200 }
      )
    }

    // Build engagement query
    let engQuery = db
      .from('engagements')
      .select('*')
      .eq('firm_id', session!.firm_id)
      .eq('engagement_status', 'OPEN')
      .limit(50)

    // Client users: filter to their assigned company only
    if (isClient && session!.company_id) {
      engQuery = engQuery.eq('company_id', session!.company_id) as any
    }

    const { data: engagementsRaw, error: engError } = await engQuery
    if (engError) throw engError

    const engagements = (engagementsRaw || []) as Engagement[]

    if (engagements.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
        },
        { status: 200 }
      )
    }

    // Collect request items for all matching engagements
    const allRequestItems: (RequestItem & {
      engagement_name?: string
      engagement_code?: string
    })[] = []

    for (const engagement of engagements) {
      const { data: items, error: itemsError } = await db
        .from('request_items')
        .select('*')
        .eq('firm_id', session!.firm_id)
        .eq('engagement_id', engagement.engagement_id)
        .limit(200)

      if (itemsError) throw itemsError

      ;(items || []).forEach((item: RequestItem) => {
        allRequestItems.push({
          ...item,
          engagement_name: engagement.engagement_name,
          engagement_code: engagement.engagement_code,
        })
      })
    }

    // Sort: REJECTED/REQUESTED first (action needed), APPROVED last
    const statusOrder: Record<string, number> = {
      REJECTED: 0,
      REQUESTED: 1,
      UPLOADED: 2,
      UNDER_REVIEW: 3,
      APPROVED: 4,
    }
    allRequestItems.sort((a, b) => {
      const statusDiff = (statusOrder[a.item_status] ?? 5) - (statusOrder[b.item_status] ?? 5)
      if (statusDiff !== 0) return statusDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return NextResponse.json(
      {
        success: true,
        data: allRequestItems,
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: '권한이 없습니다' } },
        { status: 403 }
      )
    }
    console.error('Portal requests error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
