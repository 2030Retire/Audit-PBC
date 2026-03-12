/**
 * GET /api/portal/requests/[requestItemId]
 * Get single request item detail for portal — includes files (with signed URLs) and client-visible comments
 * Accessible by any authenticated user (client, firm_admin, firm_staff)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { RequestItem, RequestItemFile, RequestItemComment } from '@/lib/db/types'

const SIGNED_URL_TTL_SECONDS = 3600 // 1 hour

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestItemId: string }> }
) {
  try {
    const { requestItemId } = await params
    const session = await getSession(req)
    assertRole(session, ['client', 'firm_admin', 'firm_staff', 'platform_admin'])

    const db = getServiceClient()
    const query = new ScopedQuery(db)

    // Get request item
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

    // Get uploaded files
    const { data: filesRaw, error: filesError } = await db
      .from('request_item_files')
      .select('*')
      .eq('firm_id', session!.firm_id)
      .eq('request_item_id', requestItemId)
      .eq('is_latest_version', true)
      .order('created_at', { ascending: false })

    if (filesError) throw filesError
    const files = (filesRaw || []) as RequestItemFile[]

    // Generate signed download URLs for Supabase Storage files
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

    // Get comments — clients see only CLIENT_VISIBLE; firm staff see all
    const isClient = session!.role === 'client'
    let commentsQuery = db
      .from('request_item_comments')
      .select('*')
      .eq('firm_id', session!.firm_id)
      .eq('request_item_id', requestItemId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (isClient) {
      commentsQuery = commentsQuery.eq('comment_visibility', 'CLIENT_VISIBLE') as any
    }

    const { data: comments, error: commentsError } = await commentsQuery
    if (commentsError) throw commentsError

    return NextResponse.json(
      {
        success: true,
        data: {
          request_item: requestItem,
          files: filesWithUrls,
          comments: (comments || []) as RequestItemComment[],
        },
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
    console.error('Portal request item detail error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
