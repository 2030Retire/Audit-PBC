/**
 * Request Item Service
 * CRUD operations for request items and comments
 * Scoped by firm_id
 * Manages status transitions and audit logging
 * Uses service role client for all operations (bypasses RLS)
 */

import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { RequestItem, RequestItemComment } from '@/lib/db/types'
import { auditLog } from '@/lib/utils/auditLogger'

export type RequestItemStatus = 'REQUESTED' | 'UPLOADED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'

export class RequestItemService {
  /**
   * List request items for engagement
   */
  static async listRequestItems(
    firmId: string,
    engagementId: string,
    status?: RequestItemStatus,
    limit = 100
  ): Promise<RequestItem[]> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    const filters: Record<string, any> = { engagement_id: engagementId }
    if (status) filters.item_status = status

    return await query.select<RequestItem>(
      'request_items',
      firmId,
      filters,
      limit
    )
  }

  /**
   * Get request item by ID with firm scope
   */
  static async getRequestItem(
    firmId: string,
    requestItemId: string
  ): Promise<RequestItem | null> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    return await query.selectOne<RequestItem>(
      'request_items',
      firmId,
      { request_item_id: requestItemId }
    )
  }

  /**
   * Update request item status
   */
  static async updateStatus(
    firmId: string,
    requestItemId: string,
    newStatus: RequestItemStatus,
    reviewedByUserId?: string,
    updatedByUserId?: string
  ): Promise<RequestItem> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    // Verify request item exists
    const existing = await this.getRequestItem(firmId, requestItemId)
    if (!existing) {
      throw new Error('REQUEST_ITEM_NOT_FOUND')
    }

    const updatePayload: any = {
      item_status: newStatus,
      updated_at: new Date().toISOString(),
    }

    // Set review info if transitioning to review/approval state
    if (
      (newStatus === 'UNDER_REVIEW' ||
        newStatus === 'APPROVED' ||
        newStatus === 'REJECTED') &&
      reviewedByUserId
    ) {
      updatePayload.reviewed_by = reviewedByUserId
      updatePayload.reviewed_at = new Date().toISOString()
    }

    const updated = await query.update<RequestItem>(
      'request_items',
      firmId,
      requestItemId,
      updatePayload,
      'request_item_id'
    )

    await auditLog(
      firmId,
      updatedByUserId || reviewedByUserId || null,
      'REQUEST_ITEM',
      requestItemId,
      'UPDATE',
      'SUCCESS',
      `Request item status changed to ${newStatus}`,
      { previousStatus: existing.item_status, newStatus }
    )

    return updated
  }

  /**
   * Mark request item complete by client
   */
  static async markClientComplete(
    firmId: string,
    requestItemId: string,
    clientUserId: string
  ): Promise<RequestItem> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    const existing = await this.getRequestItem(firmId, requestItemId)
    if (!existing) {
      throw new Error('REQUEST_ITEM_NOT_FOUND')
    }

    const updated = await query.update<RequestItem>(
      'request_items',
      firmId,
      requestItemId,
      {
        client_marked_complete_at: new Date().toISOString(),
        item_status: 'UPLOADED',
        updated_at: new Date().toISOString(),
      },
      'request_item_id'
    )

    await auditLog(
      firmId,
      clientUserId,
      'REQUEST_ITEM',
      requestItemId,
      'UPDATE',
      'SUCCESS',
      'Client marked request item as complete'
    )

    return updated
  }

  /**
   * Get request item comments
   */
  static async getComments(
    firmId: string,
    requestItemId: string,
    limit = 100
  ): Promise<RequestItemComment[]> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    return await query.select<RequestItemComment>(
      'request_item_comments',
      firmId,
      { request_item_id: requestItemId },
      limit
    )
  }

  /**
   * Add comment
   */
  static async addComment(
    firmId: string,
    engagementId: string,
    requestItemId: string,
    authorUserId: string,
    commentBody: string,
    visibility: 'CLIENT_VISIBLE' | 'INTERNAL_ONLY' = 'CLIENT_VISIBLE',
    parentCommentId?: string
  ): Promise<RequestItemComment> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    // Verify request item exists
    const requestItem = await this.getRequestItem(firmId, requestItemId)
    if (!requestItem) {
      throw new Error('REQUEST_ITEM_NOT_FOUND')
    }

    const comment = await query.insert<RequestItemComment>(
      'request_item_comments',
      firmId,
      {
        engagement_id: engagementId,
        request_item_id: requestItemId,
        author_user_id: authorUserId,
        comment_body: commentBody,
        comment_visibility: visibility,
        comment_type: 'TEXT',
        parent_comment_id: parentCommentId || null,
      }
    )

    await auditLog(
      firmId,
      authorUserId,
      'REQUEST_ITEM',
      requestItemId,
      'UPDATE',
      'SUCCESS',
      `Comment added (${visibility})`,
      { commentLength: commentBody.length }
    )

    return comment
  }

  /**
   * Get comments visible to client
   */
  static async getClientVisibleComments(
    firmId: string,
    requestItemId: string,
    limit = 100
  ): Promise<RequestItemComment[]> {
    const client = getServiceClient()

    const { data, error } = await client
      .from('request_item_comments')
      .select('*')
      .eq('firm_id', firmId)
      .eq('request_item_id', requestItemId)
      .eq('comment_visibility', 'CLIENT_VISIBLE')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data || []) as RequestItemComment[]
  }

  /**
   * Get all comments (internal access)
   */
  static async getAllComments(
    firmId: string,
    requestItemId: string,
    limit = 100
  ): Promise<RequestItemComment[]> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    return await query.select<RequestItemComment>(
      'request_item_comments',
      firmId,
      { request_item_id: requestItemId },
      limit
    )
  }
}
