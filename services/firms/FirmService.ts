/**
 * Firm Service — platform admin operations
 * Uses service role client to bypass RLS
 */

import { getServiceClient } from '@/lib/db/client'
import { Firm, StorageConfig, FirmBranding, FirmStoragePolicy } from '@/lib/db/types'
import { auditLog } from '@/lib/utils/auditLogger'

export class FirmService {

  static async createFirm(
    firmCode: string,
    firmName: string,
    domainPrefix: string,
    storageStrategy: 'SHARED' | 'PRIVATE',
    createdByUserId?: string
  ): Promise<Firm> {
    const db = getServiceClient()

    const { data: firm, error } = await db
      .from('firms')
      .insert({
        firm_code: firmCode,
        firm_name: firmName,
        domain_prefix: domainPrefix,
        storage_strategy: storageStrategy,
        status: 'ACTIVE',
        billing_status: 'TRIAL',
        default_locale: 'ko-KR',
        default_timezone: 'Asia/Seoul',
        created_by: createdByUserId || null,
      })
      .select()
      .single()

    if (error) throw error
    const newFirm = firm as Firm

    await db.from('firm_storage_policies').insert({
      firm_id: newFirm.firm_id,
      stored_filename_rule_code: 'DOCNO_ORIGINAL',
      stored_filename_template: '{doc_no}_{original_filename}',
      path_rule_code: 'YEAR_ENGAGEMENT',
      path_template: '/{fiscal_year}_{engagement_code}',
      status_prefix_sync_enabled: false,
      approved_prefix: '[Approved]_',
      pending_prefix: '[Pending]_',
      rejected_prefix: '[Rejected]_',
      rename_on_status_change: false,
    })

    await db.from('firm_brandings').insert({
      firm_id: newFirm.firm_id,
      portal_display_name: firmName,
    })

    await auditLog(newFirm.firm_id, null, 'FIRM', newFirm.firm_id, 'CREATE', 'SUCCESS', `Firm created: ${firmName}`)
    return newFirm
  }

  static async listFirms(status?: string, storageStrategy?: string, limit = 50): Promise<Firm[]> {
    const db = getServiceClient()
    let query = db.from('firms').select('*').order('created_at', { ascending: false }).limit(limit)
    if (status) query = (query as any).eq('status', status)
    if (storageStrategy) query = (query as any).eq('storage_strategy', storageStrategy)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Firm[]
  }

  static async getFirm(firmId: string): Promise<Firm | null> {
    const db = getServiceClient()
    const { data, error } = await db.from('firms').select('*').eq('firm_id', firmId).maybeSingle()
    if (error) throw error
    return data as Firm | null
  }

  static async updateFirm(firmId: string, updates: Partial<Firm>, updatedByUserId?: string): Promise<Firm> {
    const db = getServiceClient()
    const { data, error } = await db
      .from('firms')
      .update({ ...updates, updated_by: updatedByUserId || null, updated_at: new Date().toISOString() })
      .eq('firm_id', firmId)
      .select()
      .single()
    if (error) throw error
    return data as Firm
  }

  static async getStorageConfig(firmId: string): Promise<StorageConfig | null> {
    const db = getServiceClient()
    const { data, error } = await db
      .from('storage_configs').select('*').eq('firm_id', firmId).eq('is_active', true).maybeSingle()
    if (error) throw error
    return data as StorageConfig | null
  }

  static async getBranding(firmId: string): Promise<FirmBranding | null> {
    const db = getServiceClient()
    const { data, error } = await db.from('firm_brandings').select('*').eq('firm_id', firmId).maybeSingle()
    if (error) throw error
    return data as FirmBranding | null
  }

  static async getStoragePolicy(firmId: string): Promise<FirmStoragePolicy | null> {
    const db = getServiceClient()
    const { data, error } = await db.from('firm_storage_policies').select('*').eq('firm_id', firmId).maybeSingle()
    if (error) throw error
    return data as FirmStoragePolicy | null
  }
}
