/**
 * Companies List Page
 * /admin/companies
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Company } from '@/lib/db/types'

interface CreateCompanyForm {
  company_code: string
  company_name: string
  fiscal_year_end_mmdd: string
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<CreateCompanyForm>({
    company_code: '',
    company_name: '',
    fiscal_year_end_mmdd: '',
  })

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/companies')
      const result = await response.json()

      if (result.success) {
        setCompanies(result.data || [])
      } else {
        setError(result.error?.message || '고객사 목록 로드 실패')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (result.success) {
        setShowModal(false)
        setForm({
          company_code: '',
          company_name: '',
          fiscal_year_end_mmdd: '',
        })
        await fetchCompanies()
      } else {
        setCreateError(result.error?.message || '생성 실패')
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">로딩 중...</div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">고객사 목록</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + 새 고객사 등록
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {companies.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <p className="text-lg mb-2">등록된 고객사가 없습니다</p>
          <p className="text-sm">"새 고객사 등록" 버튼으로 첫 번째 고객사를 등록하세요</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  고객사 코드
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  고객사명
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  상태
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  재무연도 마감일
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  등록일
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {companies.map((company) => (
                <tr key={company.company_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">
                    {company.company_code}
                  </td>
                  <td className="px-6 py-4 font-medium">{company.company_name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        company.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {company.status === 'ACTIVE' ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {company.fiscal_year_end_mmdd
                      ? `${company.fiscal_year_end_mmdd.slice(0, 2)}/${company.fiscal_year_end_mmdd.slice(
                          2
                        )}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {new Date(company.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/companies/${company.company_id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
            <h3 className="text-lg font-bold mb-6">새 고객사 등록</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  고객사 이름 *
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) =>
                    setForm({ ...form, company_name: e.target.value })
                  }
                  placeholder="예: 삼성전자"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  고객사 코드 *
                </label>
                <input
                  type="text"
                  value={form.company_code}
                  onChange={(e) =>
                    setForm({ ...form, company_code: e.target.value.toUpperCase() })
                  }
                  placeholder="예: SAMSUNG"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">영문 대문자, 고유값</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  재무연도 마감일 (선택)
                </label>
                <input
                  type="text"
                  value={form.fiscal_year_end_mmdd}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fiscal_year_end_mmdd: e.target.value
                        .replace(/[^\d]/g, '')
                        .slice(0, 4),
                    })
                  }
                  placeholder="예: 1231 (12/31)"
                  maxLength={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">MMDD 형식 (월일)</p>
              </div>
              {createError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
                  {createError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setCreateError(null)
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {creating ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}