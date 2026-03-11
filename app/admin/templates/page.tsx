/**
 * Template Management Page
 * /admin/templates
 *
 * Create and manage PBC request item templates by audit type
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'
import { parseFileToItems, downloadSampleCsv } from '@/lib/utils/excelParser'

interface TemplateItem {
  template_item_id?: string
  doc_no: string
  item_title: string
  item_description?: string
  required_flag: boolean
  allow_multiple_files: boolean
  sort_order: number
  pbc_category?: string
}

interface Template {
  template_id: string
  template_code: string
  template_name: string
  fiscal_year_type: string | null
  version_no: number
  is_active: boolean
  created_at: string
  template_items?: TemplateItem[]
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [previewItems, setPreviewItems] = useState<TemplateItem[]>([])
  const [form, setForm] = useState({
    template_code: '',
    template_name: '',
    fiscal_year_type: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/templates')
      const result = await res.json()
      if (result.success) setTemplates(result.data || [])
      else setError(result.error?.message || '로드 실패')
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTemplateDetail(templateId: string) {
    const res = await fetch(`/api/admin/templates/${templateId}`)
    const result = await res.json()
    if (result.success) setSelectedTemplate(result.data)
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const items = await parseFileToItems(file)
      setPreviewItems(items)
    } catch (err) {
      alert('파일 파싱 오류: ' + (err instanceof Error ? err.message : '알 수 없는 오류'))
    }
    e.target.value = ''
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (previewItems.length === 0) {
      setCreateError('엑셀 파일을 업로드하거나 항목을 입력해주세요')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_code: form.template_code,
          template_name: form.template_name,
          fiscal_year_type: form.fiscal_year_type || null,
          items: previewItems,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setShowCreateModal(false)
        setForm({ template_code: '', template_name: '', fiscal_year_type: '' })
        setPreviewItems([])
        await fetchTemplates()
      } else {
        setCreateError(result.error?.message || '생성 실패')
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(templateId: string, name: string) {
    if (!confirm(`"${name}" 템플릿을 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/admin/templates/${templateId}`, { method: 'DELETE' })
    const result = await res.json()
    if (result.success) await fetchTemplates()
    else alert(result.error?.message || '삭제 실패')
  }

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">요청 항목 템플릿</h2>
          <p className="text-sm text-gray-500 mt-1">감사 유형별 PBC 요청 항목 템플릿을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadSampleCsv('pbc_template_sample.csv')}
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm"
          >
            샘플 CSV 다운로드
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + 템플릿 생성
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>}

      {templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-lg mb-2">등록된 템플릿이 없습니다</p>
          <p className="text-sm">엑셀 파일로 PBC 요청 항목 목록을 업로드하여 템플릿을 만드세요</p>
          <button
            onClick={() => downloadSampleCsv()}
            className="mt-4 text-blue-600 hover:underline text-sm"
          >
            샘플 CSV 다운로드 →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {templates.map(tpl => (
            <div key={tpl.template_id} className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {tpl.template_code}
                    </span>
                    <span className="font-semibold">{tpl.template_name}</span>
                    {tpl.fiscal_year_type && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                        {tpl.fiscal_year_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    v{tpl.version_no} · {new Date(tpl.created_at).toLocaleDateString('ko-KR')} 등록
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectedTemplate?.template_id === tpl.template_id
                      ? setSelectedTemplate(null)
                      : fetchTemplateDetail(tpl.template_id)
                    }
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {selectedTemplate?.template_id === tpl.template_id ? '접기' : '항목 보기'}
                  </button>
                  <button
                    onClick={() => handleDelete(tpl.template_id, tpl.template_name)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {selectedTemplate?.template_id === tpl.template_id && selectedTemplate.template_items && (
                <div className="border-t">
                  <div className="px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 flex gap-4">
                    <span className="w-32">항목 코드</span>
                    <span className="flex-1">항목명</span>
                    <span className="w-16 text-center">필수</span>
                  </div>
                  {selectedTemplate.template_items.map((item, idx) => (
                    <div key={item.template_item_id || idx} className="px-6 py-2 flex gap-4 items-center border-t text-sm hover:bg-gray-50">
                      <span className="w-32 font-mono text-xs text-gray-500 flex-shrink-0">{item.doc_no}</span>
                      <div className="flex-1">
                        <span>{item.item_title}</span>
                        {item.item_description && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.item_description}</p>
                        )}
                      </div>
                      <span className={`w-16 text-center text-xs ${item.required_flag ? 'text-red-500' : 'text-gray-400'}`}>
                        {item.required_flag ? '필수' : '선택'}
                      </span>
                    </div>
                  ))}
                  <div className="px-6 py-2 bg-gray-50 text-xs text-gray-400 text-right">
                    총 {selectedTemplate.template_items.length}개 항목
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">새 템플릿 생성</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 코드 *</label>
                  <input
                    type="text"
                    value={form.template_code}
                    onChange={e => setForm({ ...form, template_code: e.target.value.toUpperCase() })}
                    placeholder="예: AUDIT-GENERAL"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">감사 유형 (선택)</label>
                  <input
                    type="text"
                    value={form.fiscal_year_type}
                    onChange={e => setForm({ ...form, fiscal_year_type: e.target.value })}
                    placeholder="예: 재무제표감사, 내부감사"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">템플릿명 *</label>
                <input
                  type="text"
                  value={form.template_name}
                  onChange={e => setForm({ ...form, template_name: e.target.value })}
                  placeholder="예: 일반 제조업 재무제표 감사 PBC"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Excel Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">엑셀 파일 업로드</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    📂 파일 선택
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    .xlsx, .xls, .csv 형식 · 컬럼: 항목코드, 항목명, 설명, 필수(Y/N), 복수파일(Y/N), 카테고리
                  </p>
                </div>
              </div>

              {/* Preview */}
              {previewItems.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">미리보기 ({previewItems.length}개 항목)</label>
                    <button type="button" onClick={() => setPreviewItems([])} className="text-red-400 text-xs hover:text-red-600">초기화</button>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">코드</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">항목명</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">필수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewItems.map((item, idx) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
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

              {createError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{createError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setPreviewItems([]); setCreateError(null) }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating || previewItems.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {creating ? '생성 중...' : `템플릿 생성 (${previewItems.length}개 항목)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
