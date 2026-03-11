/**
 * Engagement Detail Page
 * /admin/engagements/[engagementId]
 * - Single item add modal
 * - Excel bulk upload
 * - Template apply
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { parseFileToItems, downloadSampleCsv, exportItemsToCsv } from '@/lib/utils/excelParser'
import { Engagement, Company, RequestItem } from '@/lib/db/types'

interface CreateRequestItemForm {
  doc_no: string
  item_title: string
  item_description: string
  required_flag: boolean
  due_date: string
}

interface BulkItem {
  doc_no: string
  item_title: string
  item_description?: string
  required_flag: boolean
  allow_multiple_files: boolean
  sort_order: number
}

interface Template {
  template_id: string
  template_code: string
  template_name: string
  fiscal_year_type: string | null
}

export default function EngagementDetailPage() {
  const params = useParams()
  const engagementId = params.engagementId as string

  const [engagement, setEngagement] = useState<Engagement | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [requestItems, setRequestItems] = useState<RequestItem[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Single item modal
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<CreateRequestItemForm>({
    doc_no: '',
    item_title: '',
    item_description: '',
    required_flag: true,
    due_date: '',
  })

  // Excel bulk upload
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Template apply
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateApplying, setTemplateApplying] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  useEffect(() => {
    fetchDetail()
    fetchTemplates()
  }, [engagementId])

  async function fetchDetail() {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/engagements/${engagementId}`)
      const result = await res.json()
      if (result.success) {
        setEngagement(result.data.engagement)
        setCompany(result.data.company)
        setRequestItems(result.data.request_items || [])
      } else {
        setError(result.error?.message || '감사 정보 로드 실패')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTemplates() {
    const res = await fetch('/api/admin/templates')
    const result = await res.json()
    if (result.success) setTemplates(result.data || [])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch(`/api/admin/engagements/${engagementId}/request-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_no: form.doc_no,
          item_title: form.item_title,
          item_description: form.item_description,
          required_flag: form.required_flag,
          due_date: form.due_date || null,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setShowModal(false)
        setForm({ doc_no: '', item_title: '', item_description: '', required_flag: true, due_date: '' })
        await fetchDetail()
      } else {
        setCreateError(result.error?.message || '생성 실패')
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setCreating(false)
    }
  }

  // File parse (CSV or XLSX via CDN)
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = await parseFileToItems(file)
      const items: BulkItem[] = parsed.map(item => ({
        doc_no: item.doc_no,
        item_title: item.item_title,
        item_description: item.item_description,
        required_flag: item.required_flag,
        allow_multiple_files: item.allow_multiple_files,
        sort_order: item.sort_order,
      }))
      setBulkItems(items)
      setBulkError(null)
    } catch (err) {
      setBulkError('파일 파싱 오류: ' + (err instanceof Error ? err.message : '알 수 없는 오류'))
    }
    e.target.value = ''
  }

  function exportCurrentItems() {
    if (requestItems.length === 0) return alert('내보낼 항목이 없습니다')
    exportItemsToCsv(requestItems, `${engagement?.engagement_code || 'pbc'}_items.csv`)
  }

  async function handleBulkUpload() {
    if (bulkItems.length === 0) {
      setBulkError('업로드할 항목이 없습니다')
      return
    }
    setBulkUploading(true)
    setBulkError(null)
    try {
      const res = await fetch(`/api/admin/engagements/${engagementId}/request-items/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: bulkItems, replace_existing: replaceExisting }),
      })
      const result = await res.json()
      if (result.success) {
        setShowBulkModal(false)
        setBulkItems([])
        setReplaceExisting(false)
        await fetchDetail()
        const { created, skipped } = result.data
        alert(`업로드 완료: ${created}개 추가, ${skipped}개 건너뜀`)
      } else {
        setBulkError(result.error?.message || '업로드 실패')
      }
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setBulkUploading(false)
    }
  }

  async function handleApplyTemplate() {
    if (!selectedTemplateId) {
      setTemplateError('템플릿을 선택해주세요')
      return
    }
    setTemplateApplying(true)
    setTemplateError(null)
    try {
      // Fetch template items
      const tplRes = await fetch(`/api/admin/templates/${selectedTemplateId}`)
      const tplResult = await tplRes.json()
      if (!tplResult.success) throw new Error(tplResult.error?.message || '템플릿 로드 실패')

      const templateItems = tplResult.data.template_items || []
      if (templateItems.length === 0) {
        setTemplateError('템플릿에 항목이 없습니다')
        return
      }

      // Bulk insert
      const res = await fetch(`/api/admin/engagements/${engagementId}/request-items/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: templateItems.map((item: {
            doc_no: string
            item_title: string
            item_description?: string
            required_flag: boolean
            allow_multiple_files: boolean
            sort_order: number
            template_item_id: string
          }) => ({
            doc_no: item.doc_no,
            item_title: item.item_title,
            item_description: item.item_description,
            required_flag: item.required_flag,
            allow_multiple_files: item.allow_multiple_files,
            sort_order: item.sort_order,
            template_item_id: item.template_item_id,
          })),
          replace_existing: false,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setShowTemplateModal(false)
        setSelectedTemplateId('')
        await fetchDetail()
        const { created, skipped } = result.data
        alert(`템플릿 적용 완료: ${created}개 추가, ${skipped}개 이미 존재`)
      } else {
        setTemplateError(result.error?.message || '적용 실패')
      }
    } catch (e) {
      setTemplateError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setTemplateApplying(false)
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
    return badges[status] || badges.REQUESTED
  }

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>

  if (!engagement) {
    return (
      <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
        감사를 찾을 수 없습니다.{' '}
        <Link href="/admin/engagements" className="underline font-semibold">목록으로 돌아가기</Link>
      </div>
    )
  }

  const completedCount = requestItems.filter(i => ['APPROVED', 'UPLOADED'].includes(i.item_status)).length
  const progressPct = requestItems.length > 0 ? Math.round((completedCount / requestItems.length) * 100) : 0

  return (
    <div>
      {/* Breadcrumb */}
      <Link href="/admin/engagements" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← 감사 목록
      </Link>

      {/* Engagement Info Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">감사명</p>
            <p className="font-bold text-lg">{engagement.engagement_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">감사 코드</p>
            <p className="font-mono font-bold text-lg text-gray-700">{engagement.engagement_code}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">고객사</p>
            <p className="font-bold text-lg">{company?.company_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">회계연도</p>
            <p className="font-bold">{engagement.fiscal_year}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">마감일</p>
            <p className="font-bold">
              {engagement.due_date ? new Date(engagement.due_date).toLocaleDateString('ko-KR') : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">상태</p>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold inline-block ${
              engagement.engagement_status === 'OPEN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {engagement.engagement_status === 'OPEN' ? '진행중' : '완료'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        {requestItems.length > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>진행률</span>
              <span>{completedCount}/{requestItems.length} ({progressPct}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Request Items Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
          <div>
            <h3 className="text-lg font-bold">요청 항목</h3>
            <p className="text-sm text-gray-500">총 {requestItems.length}개</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => downloadSampleCsv()}
              className="text-xs px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              샘플 엑셀
            </button>
            {requestItems.length > 0 && (
              <button
                onClick={exportCurrentItems}
                className="text-xs px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                엑셀 내보내기
              </button>
            )}
            <button
              onClick={() => setShowTemplateModal(true)}
              className="text-sm px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
            >
              📋 템플릿 적용
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="text-sm px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              📂 엑셀 업로드
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="text-sm px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              + 항목 추가
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>
        )}

        {requestItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-lg mb-2">등록된 요청 항목이 없습니다</p>
            <p className="text-sm mb-4">템플릿 적용이나 엑셀 업로드로 항목을 일괄 등록하세요</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowTemplateModal(true)} className="text-purple-600 hover:underline text-sm">
                📋 템플릿 적용 →
              </button>
              <button onClick={() => setShowBulkModal(true)} className="text-blue-600 hover:underline text-sm">
                📂 엑셀 업로드 →
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 w-32">Doc No</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">항목명</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 w-16">필수</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 w-20">상태</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 w-20">파일</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 w-24">마감일</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requestItems.map((item) => {
                  const badge = getStatusBadge(item.item_status)
                  return (
                    <tr key={item.request_item_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.doc_no}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.item_title}</div>
                        {item.item_description && (
                          <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{item.item_description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.required_flag ? (
                          <span className="text-red-500 text-xs font-medium">필수</span>
                        ) : (
                          <span className="text-gray-300 text-xs">선택</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {item.uploaded_files_count || 0}개
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {item.due_date ? new Date(item.due_date).toLocaleDateString('ko-KR') : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Single Item Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
            <h3 className="text-lg font-bold mb-6">요청 항목 추가</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">항목 코드 (Doc No) *</label>
                <input
                  type="text"
                  value={form.doc_no}
                  onChange={(e) => setForm({ ...form, doc_no: e.target.value })}
                  placeholder="예: CASH-001, AR-001"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">항목명 *</label>
                <input
                  type="text"
                  value={form.item_title}
                  onChange={(e) => setForm({ ...form, item_title: e.target.value })}
                  placeholder="예: 은행 잔액 증명서"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                <textarea
                  value={form.item_description}
                  onChange={(e) => setForm({ ...form, item_description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={form.required_flag}
                  onChange={(e) => setForm({ ...form, required_flag: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="required" className="text-sm text-gray-700">필수 항목</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">마감일 (선택)</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {createError && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{createError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setCreateError(null) }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
                <button type="submit" disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium">{creating ? '추가 중...' : '추가'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Excel Upload Modal ── */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">엑셀 일괄 업로드</h3>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  📂 엑셀 파일 선택
                </button>
                <p className="text-xs text-gray-400 mt-2">컬럼: 항목코드, 항목명, 설명, 필수(Y/N), 복수파일(Y/N)</p>
                <button onClick={() => downloadSampleCsv()} className="text-xs text-gray-400 hover:text-gray-600 mt-1 underline">
                  샘플 파일 다운로드
                </button>
              </div>

              {bulkItems.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">미리보기 ({bulkItems.length}개)</span>
                    <button onClick={() => setBulkItems([])} className="text-xs text-red-400 hover:text-red-600">초기화</button>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">코드</th>
                          <th className="px-3 py-2 text-left">항목명</th>
                          <th className="px-3 py-2 text-center">필수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkItems.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-1.5 font-mono text-gray-500">{item.doc_no}</td>
                            <td className="px-3 py-1.5">{item.item_title}</td>
                            <td className="px-3 py-1.5 text-center">{item.required_flag ? '✅' : '○'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <input
                  type="checkbox"
                  id="replaceExisting"
                  checked={replaceExisting}
                  onChange={e => setReplaceExisting(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="replaceExisting" className="text-sm text-yellow-800">
                  기존 항목 모두 삭제 후 교체 (주의: 되돌릴 수 없음)
                </label>
              </div>

              {bulkError && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{bulkError}</div>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowBulkModal(false); setBulkItems([]); setBulkError(null) }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
                <button onClick={handleBulkUpload} disabled={bulkUploading || bulkItems.length === 0} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium">
                  {bulkUploading ? '업로드 중...' : `업로드 (${bulkItems.length}개)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Apply Modal ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">템플릿 적용</h3>
            <p className="text-sm text-gray-500 mb-6">템플릿의 요청 항목을 현재 감사에 추가합니다 (기존 항목은 유지됩니다)</p>
            <div className="space-y-4">
              {templates.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p>등록된 템플릿이 없습니다</p>
                  <a href="/admin/templates" className="text-blue-500 hover:underline text-sm" target="_blank">
                    템플릿 관리 →
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(tpl => (
                    <label
                      key={tpl.template_id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplateId === tpl.template_id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        value={tpl.template_id}
                        checked={selectedTemplateId === tpl.template_id}
                        onChange={() => setSelectedTemplateId(tpl.template_id)}
                        className="text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{tpl.template_code}</span>
                          <span className="text-sm font-medium">{tpl.template_name}</span>
                        </div>
                        {tpl.fiscal_year_type && (
                          <p className="text-xs text-gray-400 mt-0.5">{tpl.fiscal_year_type}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {templateError && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{templateError}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowTemplateModal(false); setSelectedTemplateId(''); setTemplateError(null) }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
                <button onClick={handleApplyTemplate} disabled={templateApplying || !selectedTemplateId} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white py-2 rounded-lg text-sm font-medium">
                  {templateApplying ? '적용 중...' : '템플릿 적용'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
