/**
 * Engagements List Page
 * /admin/engagements
 * - Auto-generate engagement code from firm pattern
 * - Template selection on creation
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Engagement, Company } from '@/lib/db/types'

interface Template {
  template_id: string
  template_code: string
  template_name: string
  fiscal_year_type: string | null
}

interface CreateEngagementForm {
  engagement_code: string
  engagement_name: string
  company_id: string
  fiscal_year: string
  due_date: string
  template_id: string
}

export default function EngagementsPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [form, setForm] = useState<CreateEngagementForm>({
    engagement_code: '',
    engagement_name: '',
    company_id: '',
    fiscal_year: new Date().getFullYear().toString(),
    due_date: '',
    template_id: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const [engRes, comRes, tplRes] = await Promise.all([
        fetch('/api/admin/engagements'),
        fetch('/api/admin/companies?limit=500'),
        fetch('/api/admin/templates'),
      ])
      const engResult = await engRes.json()
      const comResult = await comRes.json()
      const tplResult = await tplRes.json()

      if (engResult.success) setEngagements(engResult.data || [])
      else setError(engResult.error?.message || '감사 목록 로드 실패')
      if (comResult.success) setCompanies(comResult.data || [])
      if (tplResult.success) setTemplates(tplResult.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate engagement code when company & year are selected
  async function generateCode(companyId: string, fiscalYear: string) {
    if (!companyId || !fiscalYear) return
    setGeneratingCode(true)
    try {
      const res = await fetch('/api/admin/engagements/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, fiscal_year: parseInt(fiscalYear, 10) }),
      })
      const result = await res.json()
      if (result.success) {
        setForm(prev => ({ ...prev, engagement_code: result.data.engagement_code }))
      }
    } catch (e) {
      console.error('Code generation error:', e)
    } finally {
      setGeneratingCode(false)
    }
  }

  function handleCompanyChange(companyId: string) {
    setForm(prev => ({ ...prev, company_id: companyId, engagement_code: '' }))
    if (companyId && form.fiscal_year) {
      generateCode(companyId, form.fiscal_year)
    }
  }

  function handleYearChange(year: string) {
    setForm(prev => ({ ...prev, fiscal_year: year, engagement_code: '' }))
    if (form.company_id && year) {
      generateCode(form.company_id, year)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagement_code: form.engagement_code,
          engagement_name: form.engagement_name,
          company_id: form.company_id,
          fiscal_year: parseInt(form.fiscal_year, 10),
          due_date: form.due_date || null,
          template_id: form.template_id || null,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setShowModal(false)
        setForm({
          engagement_code: '',
          engagement_name: '',
          company_id: '',
          fiscal_year: new Date().getFullYear().toString(),
          due_date: '',
          template_id: '',
        })
        await fetchData()
      } else {
        setCreateError(result.error?.message || '생성 실패')
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setCreating(false)
    }
  }

  const getCompanyName = (companyId: string) =>
    companies.find((c) => c.company_id === companyId)?.company_name || '-'

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">감사 목록</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + 새 감사 등록
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>
      )}

      {engagements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <p className="text-lg mb-2">등록된 감사가 없습니다</p>
          <p className="text-sm">"새 감사 등록" 버튼으로 첫 번째 감사를 등록하세요</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">감사 코드</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">감사명</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">고객사</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">회계연도</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">마감일</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">상태</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {engagements.map((engagement) => (
                <tr key={engagement.engagement_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">{engagement.engagement_code}</td>
                  <td className="px-6 py-4 font-medium">{engagement.engagement_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getCompanyName(engagement.company_id)}</td>
                  <td className="px-6 py-4 text-sm">{engagement.fiscal_year}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {engagement.due_date ? new Date(engagement.due_date).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        engagement.engagement_status === 'OPEN'
                          ? 'bg-blue-100 text-blue-800'
                          : engagement.engagement_status === 'CLOSED'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {engagement.engagement_status === 'CLOSED' ? '완료' : '진행중'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/engagements/${engagement.engagement_id}`}
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">새 감사 등록</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Engagement Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">감사명 *</label>
                <input
                  type="text"
                  value={form.engagement_name}
                  onChange={(e) => setForm({ ...form, engagement_name: e.target.value })}
                  placeholder="예: 2024년 재무제표 감사"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">고객사 *</label>
                <select
                  value={form.company_id}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">선택...</option>
                  {companies.map((c) => (
                    <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              {/* Fiscal Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">회계연도 *</label>
                <input
                  type="number"
                  value={form.fiscal_year}
                  onChange={(e) => handleYearChange(e.target.value)}
                  min="2000"
                  max="2100"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Engagement Code (Auto-generated) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  감사 코드 *
                  {generatingCode && <span className="ml-2 text-xs text-blue-500">자동 생성 중...</span>}
                  {!generatingCode && form.engagement_code && <span className="ml-2 text-xs text-green-500">✓ 자동 생성됨</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.engagement_code}
                    onChange={(e) => setForm({ ...form, engagement_code: e.target.value.toUpperCase() })}
                    placeholder={form.company_id && form.fiscal_year ? '자동 생성 중...' : '고객사와 연도를 먼저 선택하세요'}
                    required
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => generateCode(form.company_id, form.fiscal_year)}
                    disabled={!form.company_id || !form.fiscal_year || generatingCode}
                    className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg border border-gray-300"
                    title="코드 재생성"
                  >
                    🔄
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">고객사와 연도 선택 시 자동 생성됩니다 (직접 수정 가능)</p>
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PBC 템플릿 (선택)</label>
                <select
                  value={form.template_id}
                  onChange={(e) => setForm({ ...form, template_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">템플릿 없음 (수동 등록)</option>
                  {templates.map((t) => (
                    <option key={t.template_id} value={t.template_id}>
                      [{t.template_code}] {t.template_name}
                      {t.fiscal_year_type ? ` — ${t.fiscal_year_type}` : ''}
                    </option>
                  ))}
                </select>
                {form.template_id && (
                  <p className="text-xs text-green-600 mt-1">✓ 선택한 템플릿의 요청 항목이 자동으로 등록됩니다</p>
                )}
                {templates.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    등록된 템플릿이 없습니다.{' '}
                    <a href="/admin/templates" className="text-blue-500 hover:underline" target="_blank">템플릿 관리</a>에서 먼저 생성하세요.
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">마감일 (선택)</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {createError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{createError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setCreateError(null) }}
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
