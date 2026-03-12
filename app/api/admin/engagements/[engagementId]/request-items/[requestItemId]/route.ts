/**
 * GET /api/admin/engagements/[engagementId]/request-items/[requestItemId]
 * Get request item detail with comments + uploaded files (firm admin or staff)
 *
 * PATCH /api/admin/engagements/[engagementId]/request-items/[requestItemId]
 * Update request item status (firm admin or staff)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { RequestItemService, RequestItemStatus } from '@/services/request-items/RequestItemService'
import { getServiceClient } from '@/lib/db/client'
import { RequestItemFile } from '@/lib/db/types'

const SIGNED_URL_TTL_SECONDS = 3600 // 1 hour

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
          error: { code: 'REQUEST_ITEM_NOT_FOUND', message: `Request item ${requestItemId} not found` },
        },
        { status: 404 }
      )
    }

    // Get all comments (internal access — all visibility levels)
    const comments = await RequestItemService.getAllComments(
      session!.firm_id,
      requestItemId,
      200
    )

    // Get uploaded files with signed URLs
    const db = getServiceClient()
    const { data: filesRaw, error: filesError } = await db
      .from('request_item_files')
      .select('*')
      .eq('firm_id', session!.firm_id)
      .eq('request_item_id', requestItemId)
      .eq('upload_status', 'COMPLETED')
      .order('created_at', { ascending: false })

    if (filesError) throw filesError
    const files = (filesRaw || []) as RequestItemFile[]

    const filesWithUrls = await Promise.all(
      files.map(async (f) => {
        let download_url: string | null = null

        if (f.storage_provider_type === 'SUPABASE_STORAGE' && f.storage_relative_path) {
          const { data: signedData } = await db.storage
            .from('pbc-files')
            .createSignedUrl(f.storage_relative_path, SIGNED_URL_TTL_SECONDS, {
              download: f.original_filename,
            })
          download_url = signedData?.signedUrl ?? null
        } else if (f.sharepoint_web_url) {
          download_url = f.sharepoint_web_url
        }

        return { ...f, download_url }
      })
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          request_item: requestItem,
          comments,
          files: filesWithUrls,
        },
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }
    console.error('Request item detail error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
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
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const body = await req.json()
    const { item_status, comment_body, comment_visibility = 'CLIENT_VISIBLE' } = body

    if (!item_status) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'item_status is required' } },
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

    // Add comment if provided (auto-includes status change info)
    const autoComment = `[상태 변경: ${item_status}]${comment_body ? ` ${comment_body}` : ''}`
    await RequestItemService.addComment(
      session!.firm_id,
      updated.engagement_id,
      requestItemId,
      session!.user_id,
      comment_body ? autoComment : `[상태 변경: ${item_status}]`,
      comment_visibility as 'CLIENT_VISIBLE' | 'INTERNAL_ONLY'
    )

    return NextResponse.json(
      {
        success: true,
        data: updated,
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }
    console.error('Request item update error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
