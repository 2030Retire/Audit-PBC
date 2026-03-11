/**
 * GET  /api/admin/templates  - List templates for firm
 * POST /api/admin/templates  - Create template (with items)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, assertAccess } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin', 'firm_staff'])

    const db = getServiceClient()
    const { data, error } = await db
      .from('templates')
      .select('*, template_items(count)')
      .eq('firm_id', session!.firm_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    assertAccess(session, session!.firm_id, ['firm_admin'])

    const body = await req.json()
    const { template_code, template_name, fiscal_year_type, items } = body

    if (!template_code || !template_name) {
      return NextResponse.json(
        { success: false, error: { message: 'template_code and template_name are required' } },
        { status: 400 }
      )
    }

    const db = getServiceClient()

    // Create template
    const { data: template, error: tmplErr } = await db
      .from('templates')
      .insert({
        firm_id: session!.firm_id,
        template_code: template_code.toUpperCase(),
        template_name,
        fiscal_year_type: fiscal_year_type || null,
        version_no: 1,
        is_active: true,
      })
      .select()
      .single()

    if (tmplErr) {
      if (tmplErr.message.includes('duplicate') || tmplErr.code === '23505') {
        return NextResponse.json(
          { success: false, error: { message: '이미 존재하는 템플릿 코드입니다' } },
          { status: 409 }
        )
      }
      throw new Error(tmplErr.message)
    }

    // Create template items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const itemRows = items.map((item: {
        doc_no: string
        item_title: string
        item_description?: string
        required_flag?: boolean
        allow_multiple_files?: boolean
        sort_order?: number
        pbc_category?: string
      }, idx: number) => ({
        firm_id: session!.firm_id,
        template_id: template.template_id,
        doc_no: item.doc_no || `ITEM-${String(idx + 1).padStart(3, '0')}`,
        item_title: item.item_title,
        item_description: item.item_description || null,
        required_flag: item.required_flag !== false,
        allow_multiple_files: item.allow_multiple_files || false,
        sort_order: item.sort_order || idx + 1,
        pbc_category: item.pbc_category || null,
      }))

      const { error: itemsErr } = await db.from('template_items').insert(itemRows)
      if (itemsErr) throw new Error(itemsErr.message)
    }

    // Return template with item count
    const { data: result } = await db
      .from('templates')
      .select('*, template_items(*)')
      .eq('template_id', template.template_id)
      .single()

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Template create error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
