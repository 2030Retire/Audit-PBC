/**
 * Firm Admin Dashboard — Server Component
 * /admin
 */

import React from 'react'
import Link from 'next/link'
import { requireRole } from '@/lib/supabase/server'
import { getSupabaseClient } from '@/lib/db/client'

export default async function AdminDashboard() {
  const user = await requireRole(['firm_admin', 'firm_staff', 'platform_admin'])
  const firm_id: string = user.user_metadata?.firm_id ?? ''

  const supabase = await getSupabaseClient()

  const [companiesRes, engagementsRes, requestsRes] = await Promise.all([
    supabase
      .from('companies')
      .select('company_id', { count: 'exact', head: true })
      .eq('firm_id', firm_id)
      .eq('status', 'ACTIVE'),
    supabase
      .from('engagements')
      .select('engagement_id', { count: 'exact', head: true })
      .eq('firm_id', firm_id)
      .eq('engagement_status', 'OPEN'),
    supabase
      .from('request_items')
      .select('request_item_id', { count: 'exact', head: true })
      .eq('firm_id', firm_id)
      .eq('item_status', 'REQUESTED'),
  ])

  const totalCompanies = companiesRes.count ?? 0
  const activeEngagements = engagementsRes.count ?? 0
  const pendingRequests = requestsRes.count ?? 0

  const stats = [
    { label: '고객사', value: totalCompanies, href: '/admin/companies', color: 'text-blue-600' },
    { label: '진행 중인 감사', value: activeEngagements, href: '/admin/engagements', color: 'text-green-600' },
    { label: '미제출 요청 항목', value: pendingRequests, href: '/admin/engagements', color: 'text-orange-500' },
  ]

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">대시보드</h2>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
              <h3 className="text-gray-500 text-sm font-medium">{s.label}</h3>
              <p className={`text-4xl font-bold mt-2 text-right ${s.color}`}>
                {s.value.toLocaleString('ko-KR')}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* 바로가기 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-base font-bold mb-4 text-gray-800">바로가기</h3>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/companies" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            고객사 관리
          </Link>
          <Link href="/admin/engagements" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            감사 관리
          </Link>
          <Link href="/admin/templates" className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            템플릿
          </Link>
          <Link href="/admin/pbc-codes" className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            PBC 코드
          </Link>
        </div>
      </div>
    </div>
  )
} 