/**
 * POST /api/upload/initiate
 * Initiate file upload session for a request item
 * Creates a request_item_files record with SESSION_CREATED status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertRole } from '@/lib/auth/session'
import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { RequestItemFile } from '@/lib/db/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertRole(session, ['client', 'firm_admin', 'firm_staff'])

    const body = await req.json()
    const {
      filename,
      size,
      request_item_id,
      engagement_id,
      company_id,
      mime_type,
    } = body

    if (
      !filename ||
      !request_item_id ||
      !engagement_id ||
      !company_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message:
              'filename, request_item_id, engagement_id, and company_id are required',
          },
        },
        { status: 400 }
      )
    }

    const db = getServiceClient()
    const query = new ScopedQuery(db)

    // Determine file extension
    const extension = filename.includes('.')
      ? filename.split('.').pop() || ''
      : ''

    // Create request_item_files record
    const fileRecord = await query.insert<RequestItemFile>(
      'request_item_files',
      session!.firm_id,
      {
        company_id,
        engagement_id,
        request_item_id,
        original_filename: filename,
        original_extension: extension,
        mime_type: mime_type || 'application/octet-stream',
        file_size_bytes: size || 0,
        stored_filename_rule_code: 'DOCNO_ORIGINAL',
        stored_filename_template: '{doc_no}_{original_filename}',
        stored_filename: filename,
        storage_relative_path: '',
        storage_provider_type: 'M365_SHAREPOINT',
        sharepoint_site_id: null,
        sharepoint_drive_id: null,
        sharepoint_item_id: null,
        sharepoint_web_url: null,
        etag: null,
        checksum_sha256: null,
        upload_mode: 'SIMPLE',
        upload_status: 'SESSION_CREATED',
        upload_session_id: null,
        upload_session_url: null,
        upload_offset_bytes: 0,
        resumable_status: 'NOT_APPLICABLE',
        session_expires_at: null,
        is_latest_version: true,
        version_no: 1,
        uploaded_by: session!.user_id,
        uploaded_at: null,
        approved_name_sync_status: 'NOT_APPLIED',
      }
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          file_id: fileRecord.request_item_file_id,
          status: fileRecord.upload_status,
        },
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

    console.error('Upload initiate error:', error)
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
