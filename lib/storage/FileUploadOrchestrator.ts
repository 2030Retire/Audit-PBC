/**
 * File Upload Orchestrator
 * Main pipeline for uploading files to SharePoint
 * Handles small and large uploads, metadata persistence, and audit logging
 * ZERO local disk usage - memory/streaming only
 */

import { Client } from '@microsoft/microsoft-graph-client'
import { getSupabaseClient, ScopedQuery } from '@/lib/db/client'
import { RequestItemFile, Engagement, Company, FirmStoragePolicy } from '@/lib/db/types'
import { StorageConfigResolver } from '@/lib/graph/StorageConfigResolver'
import { createGraphClient } from '@/lib/graph/GraphClientFactory'
import { SharePointPathBuilder } from '@/lib/graph/SharePointPathBuilder'
import { UploadSessionService } from '@/lib/storage/UploadSessionService'
import { FileNamingPolicy } from '@/lib/policies/FileNamingPolicy'
import { auditLog } from '@/lib/utils/auditLogger'

const SMALL_FILE_THRESHOLD = 4 * 1024 * 1024 // 4MB

export interface UploadInitiateResult {
  requestItemFileId: string
  uploadMode: 'SIMPLE' | 'RESUMABLE'
  uploadSessionUrl?: string
  fileName: string
  storagePath: string
}

export interface UploadChunkRequest {
  requestItemFileId: string
  chunkData: Buffer
  offsetBytes: number
  totalFileSize: number
}

export interface UploadChunkResult {
  nextOffset: number
  isComplete: boolean
  uploadedItemId?: string
}

export class FileUploadOrchestrator {
  /**
   * Initiate file upload
   * Validates file, creates upload session, returns upload URL
   */
  static async initiateUpload(
    firmId: string,
    engagement: Engagement,
    company: Company,
    requestItemFileId: string,
    requestItemId: string,
    originalFilename: string,
    fileSizeBytes: number,
    userId: string
  ): Promise<UploadInitiateResult> {
    // 1. Validate file
    const validation = FileNamingPolicy.validate(originalFilename, fileSizeBytes)
    if (!validation.valid) {
      throw new Error(`FILE_RULE_VIOLATION: ${validation.errors.join(', ')}`)
    }

    // 2. Get storage config
    const storageConfig = await StorageConfigResolver.resolve(firmId)

    // 3. Get storage policy
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)
    const policy = await query.selectOne<FirmStoragePolicy>(
      'firm_storage_policies',
      firmId
    )

    if (!policy) {
      throw new Error('STORAGE_POLICY_NOT_FOUND')
    }

    // 4. Build SharePoint path
    const pathResult = SharePointPathBuilder.buildPath(
      policy,
      engagement,
      company,
      // doc_no from request item
      'DOC001', // TODO: get from request_items table
      originalFilename
    )

    // 5. Create Graph client
    const graphClient = await createGraphClient(storageConfig)

    // 6. Determine upload mode and initiate
    let uploadMode: 'SIMPLE' | 'RESUMABLE' = 'SIMPLE'
    let uploadSessionUrl: string | undefined

    if (fileSizeBytes > SMALL_FILE_THRESHOLD) {
      uploadMode = 'RESUMABLE'
      const sessionResult = await UploadSessionService.createSession(
        graphClient,
        firmId,
        requestItemFileId,
        pathResult.folderPath,
        pathResult.fileName,
        FileNamingPolicy.getMimeType(originalFilename)
      )
      uploadSessionUrl = sessionResult.uploadSessionUrl
    } else {
      // For small files, we'll do simple upload
      // Update upload status to indicate readiness
      await query.update<RequestItemFile>(
        'request_item_files',
        firmId,
        requestItemFileId,
        {
          upload_mode: 'SIMPLE',
          upload_status: 'IN_PROGRESS',
          storage_relative_path: `${pathResult.folderPath}/${pathResult.fileName}`,
          updated_at: new Date().toISOString(),
        },
        'request_item_file_id'
      )
    }

    // 7. Audit log
    await auditLog(
      firmId,
      userId,
      'REQUEST_ITEM_FILE',
      requestItemFileId,
      'CREATE',
      'SUCCESS',
      `Upload initiated for ${originalFilename} (${fileSizeBytes} bytes)`,
      {
        uploadMode,
        fileName: pathResult.fileName,
        folderPath: pathResult.folderPath,
      }
    )

    return {
      requestItemFileId,
      uploadMode,
      uploadSessionUrl,
      fileName: pathResult.fileName,
      storagePath: pathResult.folderPath,
    }
  }

  /**
   * Upload file chunk (for resumable uploads)
   */
  static async uploadChunk(
    firmId: string,
    chunkRequest: UploadChunkRequest
  ): Promise<UploadChunkResult> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    // Get file record
    const fileRecord = await query.selectOne<RequestItemFile>(
      'request_item_files',
      firmId,
      { request_item_file_id: chunkRequest.requestItemFileId }
    )

    if (!fileRecord) {
      throw new Error('REQUEST_ITEM_FILE_NOT_FOUND')
    }

    if (!fileRecord.upload_session_url) {
      throw new Error('UPLOAD_SESSION_NOT_FOUND')
    }

    // Check session expiry
    if (
      fileRecord.session_expires_at &&
      UploadSessionService.isSessionExpired(fileRecord.session_expires_at)
    ) {
      throw new Error('UPLOAD_SESSION_EXPIRED')
    }

    // Get Graph client
    const storageConfig = await StorageConfigResolver.resolve(firmId)
    const graphClient = await createGraphClient(storageConfig)

    // Upload chunk
    const result = await UploadSessionService.uploadChunk(
      graphClient,
      fileRecord.upload_session_url,
      chunkRequest.chunkData,
      chunkRequest.offsetBytes,
      chunkRequest.totalFileSize
    )

    // Update offset and status
    const status = result.isComplete ? 'COMPLETED' : 'IN_PROGRESS'
    const resumableStatus = result.isComplete ? 'COMPLETED' : 'ACTIVE'

    await query.update<RequestItemFile>(
      'request_item_files',
      firmId,
      chunkRequest.requestItemFileId,
      {
        upload_offset_bytes: result.nextOffset,
        upload_status: status,
        resumable_status: resumableStatus,
        sharepoint_item_id: result.itemId || null,
        uploaded_at: result.isComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      'request_item_file_id'
    )

    return {
      nextOffset: result.nextOffset,
      isComplete: result.isComplete,
      uploadedItemId: result.itemId,
    }
  }

  /**
   * Complete simple upload (small file uploaded in request body)
   */
  static async completeSimpleUpload(
    firmId: string,
    requestItemFileId: string,
    fileData: Buffer
  ): Promise<string> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    const fileRecord = await query.selectOne<RequestItemFile>(
      'request_item_files',
      firmId,
      { request_item_file_id: requestItemFileId }
    )

    if (!fileRecord) {
      throw new Error('REQUEST_ITEM_FILE_NOT_FOUND')
    }

    // Get Graph client
    const storageConfig = await StorageConfigResolver.resolve(firmId)
    const graphClient = await createGraphClient(storageConfig)

    // Upload file directly
    const uploadPath = `${fileRecord.storage_relative_path}`
    const response = await graphClient
      .api(`/me/drive/root:/${uploadPath}:/content`)
      .put(fileData)

    // Update file record
    await query.update<RequestItemFile>(
      'request_item_files',
      firmId,
      requestItemFileId,
      {
        upload_status: 'COMPLETED',
        sharepoint_item_id: response.id,
        sharepoint_web_url: response.webUrl,
        etag: response.eTag,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      'request_item_file_id'
    )

    return response.id
  }
}
