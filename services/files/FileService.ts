/**
 * File Service
 * Manages request item files
 * Scoped by firm_id
 * Coordinates with upload orchestrator
 */

import { getSupabaseClient, ScopedQuery } from '@/lib/db/client'
import { RequestItemFile } from '@/lib/db/types'
import { auditLog } from '@/lib/utils/auditLogger'

export class FileService {
  /**
   * List files for request item
   */
  static async listFiles(
    firmId: string,
    requestItemId: string,
    includeDeleted = false,
    limit = 100
  ): Promise<RequestItemFile[]> {
    const client = await getSupabaseClient()

    let query = client
      .from('request_item_files')
      .select('*')
      .eq('firm_id', firmId)
      .eq('request_item_id', requestItemId)

    if (!includeDeleted) {
      query = query.eq('upload_status', 'COMPLETED')
    }

    const { data, error } = await query.limit(limit)

    if (error) {
      throw error
    }

    return (data || []) as RequestItemFile[]
  }

  /**
   * Get file by ID with firm scope
   */
  static async getFile(
    firmId: string,
    requestItemFileId: string
  ): Promise<RequestItemFile | null> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    return await query.selectOne<RequestItemFile>(
      'request_item_files',
      firmId,
      { request_item_file_id: requestItemFileId }
    )
  }

  /**
   * Get upload session URL for file
   */
  static async getUploadSessionUrl(
    firmId: string,
    requestItemFileId: string
  ): Promise<string | null> {
    const file = await this.getFile(firmId, requestItemFileId)
    if (!file) {
      throw new Error('FILE_NOT_FOUND')
    }

    if (!file.upload_session_url) {
      throw new Error('UPLOAD_SESSION_NOT_FOUND')
    }

    return file.upload_session_url
  }

  /**
   * Get upload progress
   */
  static async getUploadProgress(
    firmId: string,
    requestItemFileId: string
  ): Promise<{
    uploadStatus: string
    uploadOffsetBytes: number
    totalFileSize: number
    percentComplete: number
    sessionExpires?: string
  }> {
    const file = await this.getFile(firmId, requestItemFileId)
    if (!file) {
      throw new Error('FILE_NOT_FOUND')
    }

    const percentComplete =
      file.file_size_bytes > 0
        ? Math.round((file.upload_offset_bytes / file.file_size_bytes) * 100)
        : 0

    return {
      uploadStatus: file.upload_status,
      uploadOffsetBytes: file.upload_offset_bytes,
      totalFileSize: file.file_size_bytes,
      percentComplete,
      sessionExpires: file.session_expires_at || undefined,
    }
  }

  /**
   * Get latest version of file for request item
   */
  static async getLatestVersion(
    firmId: string,
    requestItemId: string
  ): Promise<RequestItemFile | null> {
    const client = await getSupabaseClient()

    const { data, error } = await client
      .from('request_item_files')
      .select('*')
      .eq('firm_id', firmId)
      .eq('request_item_id', requestItemId)
      .eq('is_latest_version', true)
      .eq('upload_status', 'COMPLETED')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return (data || null) as RequestItemFile | null
  }

  /**
   * Get download URL for file
   */
  static async getDownloadUrl(
    firmId: string,
    requestItemFileId: string
  ): Promise<string | null> {
    const file = await this.getFile(firmId, requestItemFileId)
    if (!file) {
      throw new Error('FILE_NOT_FOUND')
    }

    if (file.upload_status !== 'COMPLETED') {
      throw new Error('FILE_NOT_READY: Upload not complete')
    }

    // Return SharePoint web URL if available
    return file.sharepoint_web_url || null
  }

  /**
   * Mark file as approved (updates name if policy enabled)
   */
  static async markApproved(
    firmId: string,
    requestItemFileId: string,
    approvedByUserId: string
  ): Promise<RequestItemFile> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    const file = await this.getFile(firmId, requestItemFileId)
    if (!file) {
      throw new Error('FILE_NOT_FOUND')
    }

    const updated = await query.update<RequestItemFile>(
      'request_item_files',
      firmId,
      requestItemFileId,
      {
        approved_name_sync_status: 'APPLIED',
        updated_at: new Date().toISOString(),
      },
      'request_item_file_id'
    )

    await auditLog(
      firmId,
      approvedByUserId,
      'REQUEST_ITEM_FILE',
      requestItemFileId,
      'UPDATE',
      'SUCCESS',
      'File marked as approved'
    )

    return updated
  }

  /**
   * Mark file as rejected
   */
  static async markRejected(
    firmId: string,
    requestItemFileId: string,
    reason: string,
    rejectedByUserId: string
  ): Promise<RequestItemFile> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    const file = await this.getFile(firmId, requestItemFileId)
    if (!file) {
      throw new Error('FILE_NOT_FOUND')
    }

    const updated = await query.update<RequestItemFile>(
      'request_item_files',
      firmId,
      requestItemFileId,
      {
        upload_status: 'FAILED',
        updated_at: new Date().toISOString(),
      },
      'request_item_file_id'
    )

    await auditLog(
      firmId,
      rejectedByUserId,
      'REQUEST_ITEM_FILE',
      requestItemFileId,
      'UPDATE',
      'SUCCESS',
      'File rejected',
      { reason }
    )

    return updated
  }

  /**
   * Soft delete file
   */
  static async softDelete(
    firmId: string,
    requestItemFileId: string,
    deletedByUserId: string
  ): Promise<void> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    const file = await this.getFile(firmId, requestItemFileId)
    if (!file) {
      throw new Error('FILE_NOT_FOUND')
    }

    await query.update(
      'request_item_files',
      firmId,
      requestItemFileId,
      {
        upload_status: 'FAILED',
        updated_at: new Date().toISOString(),
      },
      'request_item_file_id'
    )

    await auditLog(
      firmId,
      deletedByUserId,
      'REQUEST_ITEM_FILE',
      requestItemFileId,
      'DELETE',
      'SUCCESS',
      `File deleted: ${file.original_filename}`
    )
  }

  /**
   * Get all files for engagement (admin view)
   */
  static async listEngagementFiles(
    firmId: string,
    engagementId: string,
    limit = 1000
  ): Promise<RequestItemFile[]> {
    const client = await getSupabaseClient()

    const { data, error } = await client
      .from('request_item_files')
      .select('*')
      .eq('firm_id', firmId)
      .eq('engagement_id', engagementId)
      .eq('upload_status', 'COMPLETED')
      .limit(limit)

    if (error) {
      throw error
    }

    return (data || []) as RequestItemFile[]
  }
}
