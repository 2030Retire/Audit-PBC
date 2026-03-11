/**
 * Company Service
 * CRUD operations for companies
 * All queries scoped to firm_id
 * Uses service role client for all operations (bypasses RLS)
 */

import { getServiceClient, ScopedQuery } from '@/lib/db/client'
import { Company } from '@/lib/db/types'
import { auditLog } from '@/lib/utils/auditLogger'

export class CompanyService {
  /**
   * List companies for firm
   */
  static async listCompanies(
    firmId: string,
    status = 'ACTIVE',
    limit = 100
  ): Promise<Company[]> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    return await query.select<Company>(
      'companies',
      firmId,
      { status },
      limit
    )
  }

  /**
   * Get company by ID with firm scope
   */
  static async getCompany(
    firmId: string,
    companyId: string
  ): Promise<Company | null> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    return await query.selectOne<Company>(
      'companies',
      firmId,
      { company_id: companyId }
    )
  }

  /**
   * Get company by code with firm scope
   */
  static async getCompanyByCode(
    firmId: string,
    companyCode: string
  ): Promise<Company | null> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    return await query.selectOne<Company>(
      'companies',
      firmId,
      { company_code: companyCode }
    )
  }

  /**
   * Create company
   */
  static async createCompany(
    firmId: string,
    companyCode: string,
    companyName: string,
    externalCustomerCode?: string,
    industryCode?: string,
    fiscalYearEndMmdd?: string,
    createdByUserId?: string
  ): Promise<Company> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    const company = await query.insert<Company>(
      'companies',
      firmId,
      {
        company_code: companyCode,
        company_name: companyName,
        external_customer_code: externalCustomerCode,
        industry_code: industryCode,
        fiscal_year_end_mmdd: fiscalYearEndMmdd,
        status: 'ACTIVE',
      }
    )

    await auditLog(
      firmId,
      createdByUserId || null,
      'COMPANY',
      company.company_id,
      'CREATE',
      'SUCCESS',
      `Company created: ${companyName}`
    )

    return company
  }

  /**
   * Update company
   */
  static async updateCompany(
    firmId: string,
    companyId: string,
    updates: Partial<Company>,
    updatedByUserId?: string
  ): Promise<Company> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    // Verify company exists and belongs to firm
    const existing = await this.getCompany(firmId, companyId)
    if (!existing) {
      throw new Error('COMPANY_NOT_FOUND')
    }

    const updated = await query.update<Company>(
      'companies',
      firmId,
      companyId,
      {
        ...updates,
        updated_at: new Date().toISOString(),
      },
      'company_id'
    )

    await auditLog(
      firmId,
      updatedByUserId || null,
      'COMPANY',
      companyId,
      'UPDATE',
      'SUCCESS',
      `Company updated: ${updated.company_name}`,
      { updates }
    )

    return updated
  }

  /**
   * Delete company (soft delete)
   */
  static async deleteCompany(
    firmId: string,
    companyId: string,
    deletedByUserId?: string
  ): Promise<void> {
    const client = getServiceClient()
    const query = new ScopedQuery(client)

    // Verify company exists and belongs to firm
    const existing = await this.getCompany(firmId, companyId)
    if (!existing) {
      throw new Error('COMPANY_NOT_FOUND')
    }

    await query.softDelete('companies', firmId, companyId, 'company_id')

    await auditLog(
      firmId,
      deletedByUserId || null,
      'COMPANY',
      companyId,
      'DELETE',
      'SUCCESS',
      `Company deleted: ${existing.company_name}`
    )
  }
}
