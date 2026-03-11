/**
 * SharePoint Path Builder
 * Constructs folder paths and file names according to storage policies
 * Handles template substitution for fiscal_year, engagement_code, etc.
 */

import { FirmStoragePolicy, Engagement, Company } from '@/lib/db/types'

export interface PathBuildResult {
  folderPath: string
  fileName: string
  displayName: string
}

export class SharePointPathBuilder {
  /**
   * Build path and filename for a request item file
   */
  static buildPath(
    policy: FirmStoragePolicy,
    engagement: Engagement,
    company: Company,
    docNo: string,
    originalFilename: string
  ): PathBuildResult {
    // Build folder path using template
    const folderPath = this.buildFolderPath(
      policy.path_template,
      engagement,
      company
    )

    // Build stored filename using template
    const fileName = this.buildFileName(
      policy.stored_filename_template,
      docNo,
      originalFilename
    )

    // Display name is original filename
    const displayName = originalFilename

    return {
      folderPath,
      fileName,
      displayName,
    }
  }

  /**
   * Build folder path from template
   * Supports: {fiscal_year}, {engagement_code}, {company_code}, {year}
   */
  private static buildFolderPath(
    template: string,
    engagement: Engagement,
    company: Company
  ): string {
    let path = template

    path = path.replace('{fiscal_year}', engagement.fiscal_year.toString())
    path = path.replace('{engagement_code}', engagement.engagement_code)
    path = path.replace('{company_code}', company.company_code)
    path = path.replace('{company_name}', company.company_name)

    const now = new Date()
    path = path.replace('{year}', now.getFullYear().toString())
    path = path.replace('{month}', String(now.getMonth() + 1).padStart(2, '0'))

    // Sanitize: remove leading/trailing slashes, ensure single slashes
    path = path.replace(/^\/+|\/+$/g, '')
    path = path.replace(/\/+/g, '/')

    return path
  }

  /**
   * Build filename from template
   * Supports: {doc_no}, {original_filename}
   */
  private static buildFileName(
    template: string,
    docNo: string,
    originalFilename: string
  ): string {
    let filename = template

    filename = filename.replace('{doc_no}', docNo)
    filename = filename.replace('{original_filename}', originalFilename)

    // Sanitize: remove special characters that are problematic in filenames
    filename = filename.replace(/[<>:"|?*]/g, '_')
    filename = filename.replace(/\/\\/g, '_')

    return filename
  }

  /**
   * Apply status prefix to filename
   * Used when status_prefix_sync is enabled
   */
  static applyStatusPrefix(
    filename: string,
    status: 'APPROVED' | 'PENDING' | 'REJECTED',
    policy: FirmStoragePolicy
  ): string {
    const prefix = {
      APPROVED: policy.approved_prefix,
      PENDING: policy.pending_prefix,
      REJECTED: policy.rejected_prefix,
    }[status]

    // Remove any existing prefix first
    let cleanName = filename
    const prefixes = [
      policy.approved_prefix,
      policy.pending_prefix,
      policy.rejected_prefix,
    ]
    for (const p of prefixes) {
      if (cleanName.startsWith(p)) {
        cleanName = cleanName.slice(p.length)
        break
      }
    }

    return prefix + cleanName
  }

  /**
   * Remove status prefix from filename
   */
  static removeStatusPrefix(
    filename: string,
    policy: FirmStoragePolicy
  ): string {
    const prefixes = [
      policy.approved_prefix,
      policy.pending_prefix,
      policy.rejected_prefix,
    ]

    for (const prefix of prefixes) {
      if (filename.startsWith(prefix)) {
        return filename.slice(prefix.length)
      }
    }

    return filename
  }
}
