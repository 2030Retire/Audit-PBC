/**
 * Engagement Service
 * CRUD operations for engagements
 * Scoped by firm_id
 * Creates SharePoint folder on engagement creation
 * Uses service role client for all operations (bypasses RLS)
 */

import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { Engagement, Company, Template } from '@/lib/db/types'
import { auditLog } from '@/lib/utils/auditLogger'
import { StorageConfigResolver } from '@/lib/graph/StorageConfigResolver'
import { createGraphClient } from '@/lib/graph/GraphClientFactory'
import { SharePointPathBuilder } from '@/lib/graph/SharePointPathBuilder'
import { FirmService } from '@/services/firms/FirmService'

export class EngagementService {
  /**
   * List engagements for firm
   */
  static async listEngagements(
    firmId: string,
    filters?: {
      companyId?: string
      fiscalYear?: number
      status?: string
    },
    limit = 100
  ): Promise<Engagement[]> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    const queryFilters: Record<string, any> = {}
    if (filters?.companyId) queryFilters.company_id = filters.companyId
    if (filters?.fiscalYear) queryFilters.fiscal_year = filters.fiscalYear
    if (filters?.status) queryFilters.engagement_status = filters.status

    return await query.select<Engagement>(
      'engagements',
      firmId,
      queryFilters,
      limit
    )
  }

  /**
   * Get engagement by ID with firm scope
   */
  static async getEngagement(
    firmId: string,
    engagementId: string
  ): Promise<Engagement | null> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    return await query.selectOne<Engagement>(
      'engagements',
      firmId,
      { engagement_id: engagementId }
    )
  }

  /**
   * Create engagement
   */
  static async createEngagement(
    firmId: string,
    companyId: string,
    templateId: string | null,
    engagementCode: string,
    engagementName: string,
    fiscalYear: number,
    dueDate?: string,
    notesClient?: string,
    notesInternal?: string,
    createdByUserId?: string
  ): Promise<Engagement> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    // Create engagement record
    const engagement = await query.insert<Engagement>(
      'engagements',
      firmId,
      {
        company_id: companyId,
        template_id: templateId,
        engagement_code: engagementCode,
        engagement_name: engagementName,
        fiscal_year: fiscalYear,
        due_date: dueDate || null,
        engagement_status: 'OPEN',
        notes_internal: notesInternal || null,
        notes_client: notesClient || null,
      }
    )

    // Create SharePoint folder (async - can fail without breaking engagement creation)
    try {
      await this.createSharePointFolder(firmId, engagement, companyId)
    } catch (error) {
      console.warn('Failed to create SharePoint folder:', error)
      // Don't fail - folder can be created later
    }

    // If template provided, copy template items to request items
    if (templateId) {
      try {
        await this.copyTemplateItems(
          firmId,
          engagement.engagement_id,
          templateId
        )
      } catch (error) {
        console.warn('Failed to copy template items:', error)
      }
    }

    await auditLog(
      firmId,
      createdByUserId || null,
      'ENGAGEMENT',
      engagement.engagement_id,
      'CREATE',
      'SUCCESS',
      `Engagement created: ${engagementName}`
    )

    return engagement
  }

  /**
   * Update engagement
   */
  static async updateEngagement(
    firmId: string,
    engagementId: string,
    updates: Partial<Engagement>,
    updatedByUserId?: string
  ): Promise<Engagement> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    // Verify engagement exists
    const existing = await this.getEngagement(firmId, engagementId)
    if (!existing) {
      throw new Error('ENGAGEMENT_NOT_FOUND')
    }

    const updated = await query.update<Engagement>(
      'engagements',
      firmId,
      engagementId,
      {
        ...updates,
        updated_at: new Date().toISOString(),
      },
      'engagement_id'
    )

    await auditLog(
      firmId,
      updatedByUserId || null,
      'ENGAGEMENT',
      engagementId,
      'UPDATE',
      'SUCCESS',
      `Engagement updated: ${updated.engagement_name}`,
      { updates }
    )

    return updated
  }

  /**
   * Close engagement
   */
  static async closeEngagement(
    firmId: string,
    engagementId: string,
    closedByUserId?: string
  ): Promise<Engagement> {
    return this.updateEngagement(
      firmId,
      engagementId,
      { engagement_status: 'CLOSED' },
      closedByUserId
    )
  }

  /**
   * Create SharePoint folder for engagement
   */
  private static async createSharePointFolder(
    firmId: string,
    engagement: Engagement,
    companyId: string
  ): Promise<void> {
    try {
      const storageConfig = await StorageConfigResolver.resolve(firmId)
      const storagePolicy = await FirmService.getStoragePolicy(firmId)

      if (!storagePolicy) {
        return // No storage policy configured
      }

      // Get company for path building
      const client = getServiceClient()
      const query = new ScopedQuery(client)
      const company = await query.selectOne<Company>(
        'companies',
        firmId,
        { company_id: companyId }
      )

      if (!company) {
        return
      }

      // Build path
      const pathResult = SharePointPathBuilder.buildPath(
        storagePolicy,
        engagement,
        company,
        'ROOT',
        'Engagement'
      )

      // Create folder via Graph
      const graphClient = await createGraphClient(storageConfig)
      const folderPath = pathResult.folderPath

      // Create path hierarchy
      const pathParts = folderPath.split('/').filter(p => p)
      let currentPath = ''

      for (const part of pathParts) {
        currentPath += '/' + part
        await graphClient
          .api(
            `/drives/${storageConfig.base_drive_id}/root:${currentPath}:/children`
          )
          .post({
            name: part,
            folder: {},
          })
          .catch(() => {
            // Ignore if already exists
          })
      }

      // Update engagement with folder path
      const query2 = new ScopedQuery(client)
      await query2.update(
        'engagements',
        firmId,
        engagement.engagement_id,
        {
          sharepoint_folder_path: `${storageConfig.base_relative_path}/${folderPath}`,
          updated_at: new Date().toISOString(),
        },
        'engagement_id'
      )
    } catch (error) {
      throw new Error(`Failed to create SharePoint folder: ${error}`)
    }
  }

  /**
   * Copy template items to request items
   */
  private static async copyTemplateItems(
    firmId: string,
    engagementId: string,
    templateId: string
  ): Promise<void> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    // Get template items
    const templateItems = await query.select(
      'template_items',
      firmId,
      { template_id: templateId }
    )

    // Create request items from template
    for (const item of templateItems) {
      await query.insert('request_items', firmId, {
        engagement_id: engagementId,
        template_item_id: item.template_item_id,
        doc_no: item.doc_no,
        item_title: item.item_title,
        item_description: item.item_description,
        required_flag: item.required_flag,
        allow_multiple_files: item.allow_multiple_files,
        item_status: 'REQUESTED',
        due_date: null,
      })
    }
  }
}
