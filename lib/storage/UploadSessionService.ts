/**
 * Upload Session Service
 * Manages resumable upload sessions for large files
 * Uses Graph API's uploadSession feature
 * Zero local disk usage - handles streaming only
 */

import { Client } from '@microsoft/microsoft-graph-client'
import { getSupabaseClient, ScopedQuery } from '@/lib/db/client'
import { RequestItemFile } from '@/lib/db/types'

const DEFAULT_SESSION_EXPIRY_MINUTES = 60

export interface SessionCreateResult {
  uploadSessionId: string
  uploadSessionUrl: string
  expiresAt: string
}

export class UploadSessionService {
  /**
   * Create resumable upload session in SharePoint
   * Stores session metadata in database
   */
  static async createSession(
    graphClient: Client,
    firmId: string,
    requestItemFileId: string,
    folderPath: string,
    fileName: string,
    mimeType: string = 'application/octet-stream'
  ): Promise<SessionCreateResult> {
    try {
      // Create upload session via Graph API
      const uploadSessionUrl = `/me/drive/root:/${folderPath}/${fileName}:/createUploadSession`

      const sessionResponse = await graphClient
        .api(uploadSessionUrl)
        .post({
          item: {
            name: fileName,
          },
        })

      if (!sessionResponse.uploadUrl) {
        throw new Error('No uploadUrl returned from Graph API')
      }

      const expiresAt = new Date(
        Date.now() + DEFAULT_SESSION_EXPIRY_MINUTES * 60 * 1000
      )

      // Store session metadata
      const client = await getSupabaseClient()
      const query = new ScopedQuery(client)

      await query.update<RequestItemFile>(
        'request_item_files',
        firmId,
        requestItemFileId,
        {
          upload_mode: 'RESUMABLE',
          upload_session_url: sessionResponse.uploadUrl,
          upload_session_id: sessionResponse.uploadUrl, // Use URL as session ID
          upload_status: 'SESSION_CREATED',
          resumable_status: 'ACTIVE',
          session_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        },
        'request_item_file_id'
      )

      return {
        uploadSessionId: sessionResponse.uploadUrl,
        uploadSessionUrl: sessionResponse.uploadUrl,
        expiresAt: expiresAt.toISOString(),
      }
    } catch (error) {
      throw new Error(`Failed to create upload session: ${error}`)
    }
  }

  /**
   * Get current session status and offset
   */
  static async getSessionStatus(
    graphClient: Client,
    uploadSessionUrl: string
  ): Promise<{
    uploadOffset: number
    sessionExpires: string | null
    isValid: boolean
  }> {
    try {
      const response = await graphClient
        .api(uploadSessionUrl)
        .get()

      return {
        uploadOffset: response.nextExpectedRanges
          ? parseInt(response.nextExpectedRanges[0].split('-')[0], 10)
          : 0,
        sessionExpires: response.expirationDateTime || null,
        isValid: !!response.uploadUrl,
      }
    } catch (error) {
      return {
        uploadOffset: 0,
        sessionExpires: null,
        isValid: false,
      }
    }
  }

  /**
   * Upload chunk for resumable upload
   * Streams chunk without writing to disk
   */
  static async uploadChunk(
    graphClient: Client,
    uploadSessionUrl: string,
    chunkData: Buffer | Uint8Array,
    offsetBytes: number,
    totalFileSize: number
  ): Promise<{
    nextOffset: number
    isComplete: boolean
    itemId?: string
  }> {
    try {
      const contentLength = chunkData.length
      const contentRange = `bytes ${offsetBytes}-${offsetBytes + contentLength - 1}/${totalFileSize}`

      const response = await graphClient
        .api(uploadSessionUrl)
        .put({
          body: chunkData,
          headers: {
            'Content-Range': contentRange,
            'Content-Length': contentLength.toString(),
          },
        })

      // Check if upload is complete
      if (response.id) {
        // Upload complete - Graph API returns the item
        return {
          nextOffset: totalFileSize,
          isComplete: true,
          itemId: response.id,
        }
      } else if (response.nextExpectedRanges && response.nextExpectedRanges.length > 0) {
        // Partial upload - get next expected offset
        const nextRange = response.nextExpectedRanges[0]
        const nextOffset = parseInt(nextRange.split('-')[0], 10)

        return {
          nextOffset,
          isComplete: false,
        }
      } else {
        throw new Error('Unexpected response from upload session')
      }
    } catch (error) {
      throw new Error(`Failed to upload chunk: ${error}`)
    }
  }

  /**
   * Cancel upload session
   */
  static async cancelSession(
    graphClient: Client,
    uploadSessionUrl: string
  ): Promise<void> {
    try {
      await graphClient
        .api(uploadSessionUrl)
        .delete()
    } catch (error) {
      // Session might already be expired - non-fatal
      console.warn(`Failed to cancel upload session: ${error}`)
    }
  }

  /**
   * Check if session is expired
   */
  static isSessionExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date()
  }
}
