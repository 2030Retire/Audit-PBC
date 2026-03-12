/**
 * POST /api/portal/requests/[requestItemId]/upload
 * Upload a file for a request item — stores in Supabase Storage
 * Accepts multipart/form-data with a "file" field
 * Updates request_item status to UPLOADED and increments file count
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { RequestItem, RequestItemFile } from '@/lib/db/types'
import { auditLog } from '@/lib/utils/auditLogger'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestItemId: string }> }
) {
  try {
    const { requestItemId } = await params
    const session = await getSession(req)
    assertRole(session, ['client', 'firm_admin', 'firm_staff', 'platform_admin'])

    // Parse multipart form
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_FILE', message: '파일이 없습니다' } },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: '파일 크기는 최대 50MB입니다' } },
        { status: 400 }
      )
    }

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

    // Get engagement to resolve company_id
    const { data: engagementRow, error: engError } = await db
      .from('engagements')
      .select('company_id')
      .eq('firm_id', session!.firm_id)
      .eq('engagement_id', requestItem.engagement_id)
      .maybeSingle()

    if (engError || !engagementRow) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '감사 정보를 찾을 수 없습니다' } },
        { status: 404 }
      )
    }
    const companyId: string = engagementRow.company_id

    // Upload to Supabase Storage
    const fileId = crypto.randomUUID()
    const ext = file.name.includes('.') ? file.name.split('.').pop()! : ''
    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._\-가-힣]/g, '_')
    const storagePath = `${session!.firm_id}/${requestItem.engagement_id}/${requestItemId}/${fileId}_${safeOriginalName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: storageError } = await db.storage
      .from('pbc-files')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (storageError) {
      console.error('Storage upload error:', storageError)
      return NextResponse.json(
        { success: false, error: { code: 'STORAGE_ERROR', message: '파일 업로드 실패: ' + storageError.message } },
        { status: 500 }
      )
    }

    // Create request_item_files record
    const fileRecord = await query.insert<RequestItemFile>(
      'request_item_files',
      session!.firm_id,
      {
        company_id: companyId,
        engagement_id: requestItem.engagement_id,
        request_item_id: requestItemId,
        original_filename: file.name,
        original_extension: ext,
        mime_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
        stored_filename_rule_code: 'UUID_ORIGINAL',
        stored_filename_template: '{uuid}_{original_filename}',
        stored_filename: `${fileId}_${safeOriginalName}`,
        storage_relative_path: storagePath,
        storage_provider_type: 'SUPABASE_STORAGE',
        sharepoint_site_id: null,
        sharepoint_drive_id: null,
        sharepoint_item_id: null,
        sharepoint_web_url: null,
        etag: null,
        checksum_sha256: null,
        upload_mode: 'SIMPLE',
        upload_status: 'COMPLETED',
        upload_session_id: null,
        upload_session_url: null,
        upload_offset_bytes: file.size,
        resumable_status: 'NOT_APPLICABLE',
        session_expires_at: null,
        is_latest_version: true,
        version_no: 1,
        uploaded_by: session!.user_id,
        uploaded_at: new Date().toISOString(),
        approved_name_sync_status: 'NOT_APPLIED',
      }
    )

    // Update request_item: increment file count + set UPLOADED status
    const newFileCount = (requestItem.uploaded_files_count || 0) + 1
    const newStatus =
      requestItem.item_status === 'REQUESTED' || requestItem.item_status === 'REJECTED'
        ? 'UPLOADED'
        : requestItem.item_status

    await db
      .from('request_items')
      .update({
        uploaded_files_count: newFileCount,
        item_status: newStatus,
        last_uploaded_at: new Date().toISOString(),
        last_uploaded_by: session!.user_id,
        updated_at: new Date().toISOString(),
      })
      .eq('firm_id', session!.firm_id)
      .eq('request_item_id', requestItemId)

    // Auto-comment: file upload event
    await db
      .from('request_item_comments')
      .insert({
        firm_id: session!.firm_id,
        engagement_id: requestItem.engagement_id,
        request_item_id: requestItemId,
        author_user_id: session!.user_id,
        comment_body: `📎 파일 업로드: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        comment_visibility: 'CLIENT_VISIBLE',
        comment_type: 'FILE_UPLOAD',
        parent_comment_id: null,
      })

    await auditLog(
      session!.firm_id,
      session!.user_id,
      'REQUEST_ITEM_FILE',
      fileRecord.request_item_file_id,
      'CREATE',
      'SUCCESS',
      `File uploaded: ${file.name}`,
      { size: file.size, storagePath }
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          file_id: fileRecord.request_item_file_id,
          original_filename: file.name,
          file_size_bytes: file.size,
          upload_status: 'COMPLETED',
          new_item_status: newStatus,
          uploaded_files_count: newFileCount,
        },
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: '권한이 없습니다' } },
        { status: 403 }
      )
    }
    console.error('File upload error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
