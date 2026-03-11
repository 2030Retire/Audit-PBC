/**
 * Dynamic Graph Client Factory
 * Creates Microsoft Graph clients per firm with tenant-specific credentials
 * Handles client_secret decryption and token caching
 * No static global clients - each firm gets its own isolated client
 */

import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { decrypt } from '@/lib/utils/encryption'
import { StorageConfig } from '@/lib/db/types'

interface TokenCache {
  token: string
  expiresAt: number
}

// Token cache: key = "firm_id|tenant_id|client_id"
const tokenCache = new Map<string, TokenCache>()

/**
 * Get or create Graph client for firm
 * Decrypts client_secret and creates authenticated client
 */
export async function createGraphClient(
  storageConfig: StorageConfig
): Promise<Client> {
  // Decrypt the encrypted client secret
  let clientSecret: string
  try {
    clientSecret = decrypt(storageConfig.client_secret_encrypted)
  } catch (error) {
    throw new Error(`Failed to decrypt client secret: ${error}`)
  }

  // Create Azure credential
  const credential = new ClientSecretCredential(
    storageConfig.tenant_id,
    storageConfig.client_id,
    clientSecret
  )

  // Create Graph client with credential
  const client = Client.initWithMiddleware({
    authProvider: async (done: any) => {
      try {
        const token = await credential.getToken('https://graph.microsoft.com/.default')
        done(null, token.token)
      } catch (error) {
        done(error, null)
      }
    },
  })

  return client
}

/**
 * Get cached token or fetch new one
 * Manages TTL and automatic refresh
 */
export async function getGraphToken(
  storageConfig: StorageConfig
): Promise<string> {
  const cacheKey = `${storageConfig.firm_id}|${storageConfig.tenant_id}|${storageConfig.client_id}`

  // Check cache
  const cached = tokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt - 60000) {
    // 1 minute buffer before expiration
    return cached.token
  }

  // Decrypt and get new token
  let clientSecret: string
  try {
    clientSecret = decrypt(storageConfig.client_secret_encrypted)
  } catch (error) {
    throw new Error(`Failed to decrypt client secret: ${error}`)
  }

  const credential = new ClientSecretCredential(
    storageConfig.tenant_id,
    storageConfig.client_id,
    clientSecret
  )

  const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default')

  // Cache token with expiration
  tokenCache.set(cacheKey, {
    token: tokenResponse.token,
    expiresAt: tokenResponse.expiresOnTimestamp,
  })

  return tokenResponse.token
}

/**
 * Clear token cache (useful for testing or credential rotation)
 */
export function clearTokenCache(firmId?: string): void {
  if (firmId) {
    // Clear tokens for specific firm
    const keysToDelete: string[] = []
    tokenCache.forEach((_, key) => {
      if (key.startsWith(firmId)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => tokenCache.delete(key))
  } else {
    // Clear all tokens
    tokenCache.clear()
  }
}

/**
 * Test Graph credentials without creating full client
 */
export async function testGraphCredentials(
  storageConfig: StorageConfig
): Promise<boolean> {
  try {
    const token = await getGraphToken(storageConfig)
    return !!token
  } catch (error) {
    console.error('Graph credential test failed:', error)
    return false
  }
}
