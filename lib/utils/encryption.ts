/**
 * AES-256-GCM encryption for client secrets
 * Uses ENCRYPTION_KEY environment variable
 * All client_secret values must be encrypted before storage
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set')
}

// Ensure key is 32 bytes (256 bits)
const key = crypto
  .createHash('sha256')
  .update(ENCRYPTION_KEY)
  .digest()

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns IV:authTag:ciphertext in hex format for storage
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * Expects IV:authTag:ciphertext format
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Verify that a value is encrypted (contains colons)
 */
export function isEncrypted(value: string): boolean {
  return value.includes(':') && (value.match(/:/g) || []).length === 2
}
