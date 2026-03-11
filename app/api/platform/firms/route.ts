/**
 * GET /api/platform/firms
 * List all firms (platform admin only)
 *
 * POST /api/platform/firms
 * Create new firm (platform admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { FirmService } from '@/services/firms/FirmService'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertRole(session, ['platform_admin'])

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const storageStrategy = searchParams.get('storage_strategy') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const firms = await FirmService.listFirms(status, storageStrategy, limit)

    return NextResponse.json(
      {
        success: true,
        data: firms,
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

    console.error('Firms list error:', error)
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
    assertRole(session, ['platform_admin'])

    const body = await req.json()
    const {
      firm_name,
      firm_code,
      domain_prefix,
      storage_strategy,
      default_locale = 'en-US',
      default_timezone = 'America/New_York',
    } = body

    if (!firm_name || !firm_code || !domain_prefix || !storage_strategy) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message:
              'firm_name, firm_code, domain_prefix, and storage_strategy are required',
          },
        },
        { status: 400 }
      )
    }

    const firm = await FirmService.createFirm(
      firm_code,
      firm_name,
      domain_prefix,
      storage_strategy,
      session.user_id
    )

    return NextResponse.json(
      {
        success: true,
        data: firm,
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

    if (message.includes('UNIQUE')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_FIRM',
            message: 'Firm code or domain prefix already exists',
          },
        },
        { status: 409 }
      )
    }

    console.error('Firm creation error:', error)
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
