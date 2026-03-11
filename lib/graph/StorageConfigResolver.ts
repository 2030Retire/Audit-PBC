/**
 * Storage Configuration Resolver
 * Queries and retrieves the active storage config for a firm
 * Throws if not found or not active
 */

import { getSupabaseClient, ScopedQuery } from '@/lib/db/client'
import { StorageConfig } from '@/lib/db/types'

export class StorageConfigResolver {
  /**
   * Get active storage config for firm
   */
  static async resolve(firmId: string): Promise<StorageConfig> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    const config = await query.selectOne<StorageConfig>(
      'storage_configs',
      firmId,
      { is_active: true }
    )

    if (!config) {
      throw new Error(`STORAGE_CONFIG_NOT_FOUND: No active storage config for firm ${firmId}`)
    }

    // Verify connection status
    if (config.connection_status !== 'CONNECTED') {
      throw new Error(`STORAGE_CONFIG_INACTIVE: Storage config connection status is ${config.connection_status}`)
    }

    return config
  }

  /**
   * Check if firm has storage config without throwing
   */
  static async has(firmId: string): Promise<boolean> {
    try {
      await this.resolve(firmId)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get all storage configs for a firm (including inactive)
   */
  static async listAll(firmId: string): Promise<StorageConfig[]> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    const configs = await query.select<StorageConfig>(
      'storage_configs',
      firmId,
      {}
    )

    return configs
  }
}
