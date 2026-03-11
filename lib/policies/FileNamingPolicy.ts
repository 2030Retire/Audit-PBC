/**
 * File Naming Policy
 * Validates file names and extensions according to firm policies
 * Enforces business rules for file uploads
 */

export interface FileValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class FileNamingPolicy {
  // Allowed extensions (can be extended per firm)
  private static readonly ALLOWED_EXTENSIONS = new Set([
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'csv',
    'jpg',
    'jpeg',
    'png',
    'gif',
    'zip',
    'rar',
    '7z',
  ])

  // Blocked extensions (security)
  private static readonly BLOCKED_EXTENSIONS = new Set([
    'exe',
    'bat',
    'cmd',
    'com',
    'pif',
    'scr',
    'vbs',
    'js',
    'jar',
    'app',
  ])

  // Max file size: 100MB
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024

  /**
   * Validate file before upload
   */
  static validate(
    filename: string,
    fileSizeBytes: number,
    customAllowedExtensions?: string[]
  ): FileValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate filename not empty
    if (!filename || filename.trim().length === 0) {
      errors.push('Filename cannot be empty')
      return { valid: false, errors, warnings }
    }

    // Extract extension
    const ext = this.getExtension(filename).toLowerCase()
    if (!ext) {
      errors.push('File must have an extension')
      return { valid: false, errors, warnings }
    }

    // Check blocked extensions
    if (this.BLOCKED_EXTENSIONS.has(ext)) {
      errors.push(`File extension .${ext} is not allowed for security reasons`)
      return { valid: false, errors, warnings }
    }

    // Check allowed extensions
    const allowedExts = customAllowedExtensions
      ? new Set(customAllowedExtensions)
      : this.ALLOWED_EXTENSIONS

    if (!allowedExts.has(ext)) {
      errors.push(
        `File extension .${ext} is not allowed. Allowed: ${Array.from(
          allowedExts
        ).join(', ')}`
      )
      return { valid: false, errors, warnings }
    }

    // Validate file size
    if (fileSizeBytes <= 0) {
      errors.push('File size must be greater than 0')
      return { valid: false, errors, warnings }
    }

    if (fileSizeBytes > this.MAX_FILE_SIZE) {
      errors.push(
        `File size exceeds maximum of ${this.formatBytes(this.MAX_FILE_SIZE)}`
      )
      return { valid: false, errors, warnings }
    }

    // Warn on large files (>50MB)
    if (fileSizeBytes > 50 * 1024 * 1024) {
      warnings.push('Large file - upload may take longer')
    }

    // Check for problematic characters
    if (this.hasProblematicCharacters(filename)) {
      warnings.push('Filename contains special characters that may be sanitized')
    }

    // Check for long filename
    if (filename.length > 255) {
      warnings.push('Filename is very long and may be truncated')
    }

    return { valid: true, errors, warnings }
  }

  /**
   * Get file extension
   */
  static getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    if (lastDot === -1 || lastDot === 0) {
      return ''
    }
    return filename.slice(lastDot + 1)
  }

  /**
   * Get MIME type from extension
   */
  static getMimeType(filename: string): string {
    const ext = this.getExtension(filename).toLowerCase()

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
    }

    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * Check for problematic characters
   */
  private static hasProblematicCharacters(filename: string): boolean {
    return /[<>:"|?*]/.test(filename)
  }

  /**
   * Format bytes to human readable
   */
  private static formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }
}
