/**
 * GET /api/platform/firms/[firmId]
 * Get firm details (platform admin only)
 *
 * PUT /api/platform/firms/[firmId]
 * Update firm (platform admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { FirmService } from '@/services/firms/FirmService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ firmId: string }> }
) {
  try {
    const { firmId } = await params
    const session = await getSession(req)
    assertRole(session, ['platform_admin'])

    const firm = await FirmService.getFirm(firmId)

    if (!firm) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FIRM_NOT_FOUND',
            message: `Firm ${firmId} not found`,
          },
        },
        { status: 404 }
      )
    }

    const storageConfig = await FirmService.getStorageConfig(firmId)

    return NextResponse.json(
      {
        success: true,
        data: { firm, storage_config: storageConfig },
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

    console.error('Firm get error:', error)
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ firmId: string }> }
) {
  try {
    const { firmId } = await params
    const session = await getSession(req)
    assertRole(session, ['platform_admin'])

    // Verify firm exists
    const existing = await FirmService.getFirm(firmId)
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FIRM_NOT_FOUND',
            message: `Firm ${firmId} not found`,
          },
        },
        { status: 404 }
      )
    }

    const body = await req.json()

    const updated = await FirmService.updateFirm(
      firmId,
      body,
      session.user_id
    )

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

    console.error('Firm update error:', error)
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
