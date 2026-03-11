/**
 * GET /api/admin/engagements
 * List engagements for firm (firm admin or staff)
 *
 * POST /api/admin/engagements
 * Create engagement (firm admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { EngagementService } from '@/services/engagements/EngagementService'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('company_id') || undefined
    const fiscalYear = searchParams.get('fiscal_year')
      ? parseInt(searchParams.get('fiscal_year')!, 10)
      : undefined
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const engagements = await EngagementService.listEngagements(
      session!.firm_id,
      {
        companyId,
        fiscalYear,
        status,
      },
      limit
    )

    return NextResponse.json(
      {
        success: true,
        data: engagements,
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

    console.error('Engagements list error:', error)
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

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const body = await req.json()
    const {
      company_id,
      template_id,
      engagement_code,
      engagement_name,
      fiscal_year,
      due_date,
      notes_client,
      notes_internal,
    } = body

    if (
      !company_id ||
      !engagement_code ||
      !engagement_name ||
      fiscal_year === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message:
              'company_id, engagement_code, engagement_name, and fiscal_year are required',
          },
        },
        { status: 400 }
      )
    }

    const engagement = await EngagementService.createEngagement(
      session!.firm_id,
      company_id,
      template_id || null,
      engagement_code,
      engagement_name,
      fiscal_year,
      due_date,
      notes_client,
      notes_internal,
      session!.user_id
    )

    return NextResponse.json(
      {
        success: true,
        data: engagement,
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

    console.error('Engagement creation error:', error)
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
