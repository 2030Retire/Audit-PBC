/**
 * GET /api/admin/companies
 * List companies for firm (firm admin or staff)
 *
 * POST /api/admin/companies
 * Create company (firm admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { CompanyService } from '@/services/companies/CompanyService'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'ACTIVE'
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const companies = await CompanyService.listCompanies(
      session!.firm_id,
      status,
      limit
    )

    return NextResponse.json(
      {
        success: true,
        data: companies,
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions',
          },
        },
        { status: 403 }
      )
    }

    console.error('Companies list error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const body = await req.json()
    const {
      company_code,
      company_name,
      external_customer_code,
      industry_code,
      fiscal_year_end_mmdd,
    } = body

    if (!company_code || !company_name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'company_code and company_name are required',
          },
        },
        { status: 400 }
      )
    }

    const company = await CompanyService.createCompany(
      session!.firm_id,
      company_code,
      company_name,
      external_customer_code,
      industry_code,
      fiscal_year_end_mmdd,
      session!.user_id
    )

    return NextResponse.json(
      {
        success: true,
        data: company,
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions',
          },
        },
        { status: 403 }
      )
    }

    console.error('Company creation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
      { status: 500 }
    )
  }
}
