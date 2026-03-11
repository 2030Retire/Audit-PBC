/**
 * Client Portal - My Requests
 * /portal
 * Shows list of request items assigned to the logged-in client
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { RequestItem, Engagement } from '@/lib/db/types'

interface RequestItemWithEngagement extends RequestItem {
  engagement_name?: string
  engagement_code?: string
}

export default function PortalPage() {
  const [requestItems, setRequestItems] = useState<RequestItemWithEngagement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

  async function fetchRequests() {
    try {
      setLoading(true)
      const response = await fetch('/api/portal/requests')
      const result = await response.json()

      if (result.success) {
        setRequestItems(result.data || [])
      } else {
        setError(result.error?.message || '요청 목록 로드 실패')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      REQUESTED: { color: 'bg-gray-100 text-gray-800', label: '요청' },
      UPLOADED: { color: 'bg-blue-100 text-blue-800', label: '업로드됨' },
      UNDER_REVIEW: { color: 'bg-yellow-100 text-yellow-800', label: '검토중' },
      APPROVED: { color: 'bg-green-100 text-green-800', label: '승인' },
      REJECTED: { color: 'bg-red-100 text-red-800', label: '반려' },
    }
    const badge = badges[status] || badges.REQUESTED
    return badge
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">로딩 중...</div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">제 요청</h2>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {requestItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <p className="text-lg mb-2">요청 항목이 없습니다</p>
          <p className="text-sm">현재 진행 중인 감사가 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  Doc No
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  항목명
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  감사
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  상태
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  마감일
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requestItems.map((item) => {
                const statusBadge = getStatusBadge(item.item_status)
                return (
                  <tr key={item.request_item_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      {item.doc_no}
                    </td>
                    <td className="px-6 py-4 font-medium">{item.item_title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.engagement_name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.color}`}
                      >
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.due_date
                        ? new Date(item.due_date).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/portal/${item.engagement_id}/${item.request_item_id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
