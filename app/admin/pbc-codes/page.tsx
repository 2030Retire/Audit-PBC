/**
 * PBC Code Master Management Page
 * /admin/pbc-codes
 *
 * Firm Admin can view system codes and add firm-specific codes
 */

'use client'

import React, { useEffect, useState } from 'react'

interface PbcCode {
  pbc_code_id: string
  firm_id: string | null
  pbc_category: string
  pbc_code: string
  pbc_name: string
  pbc_name_en: string | null
  description: string | null
  typical_documents: string | null
  is_system: boolean
  is_active: boolean
  sort_order: number
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  GENERAL: { label: '일반', color: 'bg-gray-100 text-gray-700' },
  CASH: { label: '현금', color: 'bg-blue-100 text-blue-700' },
  AR: { label: '매출채권', color: 'bg-green-100 text-green-700' },
  INVENTORY: { label: '재고자산', color: 'bg-yellow-100 text-yellow-700' },
  PPE: { label: '유형자산', color: 'bg-orange-100 text-orange-700' },
  AP: { label: '매입채무', color: 'bg-red-100 text-red-700' },
  DEBT: { label: '차입금', color: 'bg-purple-100 text-purple-700' },
  REVENUE: { label: '매출', color: 'bg-teal-100 text-teal-700' },
  PAYROLL: { label: '급여', color: 'bg-indigo-100 text-indigo-700' },
  TAX: { label: '법인세', color: 'bg-pink-100 text-pink-700' },
  EQUITY: { label: '자본', color: 'bg-cyan-100 text-cyan-700' },
  OTHER: { label: '기타', color: 'bg-slate-100 text-slate-700' },
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS)

export default function PbcCodesPage() {
  const [codes, setCodes] = useState<PbcCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({
    pbc_category: 'GENERAL',
    pbc_code: '',
    pbc_name: '',
    pbc_name_en: '',
    description: '',
    typical_documents: '',
  })

  useEffect(() => {
    fetchCodes()
  }, [])

  async function fetchCodes() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/pbc-codes?include_system=true')
      const result = await res.json()
      if (result.success) {
        setCodes(result.data || [])
      } else {
        setError(result.error?.message || '로드 실패')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/pbc-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const result = await res.json()
      if (result.success) {
        setShowAddModal(false)
        setAddForm({ pbc_category: 'GENERAL', pbc_code: '', pbc_name: '', pbc_name_en: '', description: '', typical_documents: '' })
        await fetchCodes()
      } else {
        setCreateError(result.error?.message || '생성 실패')
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setCreating(false)
    }
  }

  async function handleDeactivate(codeId: string) {
    if (!confirm('이 코드를 비활성화하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/pbc-codes/${codeId}`, { method: 'DELETE' })
      const result = await res.json()
      if (result.success) {
        await fetchCodes()
      } else {
        alert(result.error?.message || '삭제 실패')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류 발생')
    }
  }

  const filtered = selectedCategory === 'ALL'
    ? codes
    : codes.filter(c => c.pbc_category === selectedCategory)

  // Group by category
  const grouped = filtered.reduce((acc, code) => {
    if (!acc[code.pbc_category]) acc[code.pbc_category] = []
    acc[code.pbc_category].push(code)
    return acc
  }, {} as Record<string, PbcCode[]>)

  const systemCount = codes.filter(c => c.is_system).length
  const firmCount = codes.filter(c => !c.is_system).length

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">PBC 코드 마스터</h2>
          <p className="text-sm text-gray-500 mt-1">
            시스템 코드 {systemCount}개 · 펌 고유 코드 {firmCount}개
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + 코드 추가
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            selectedCategory === 'ALL' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          전체 ({codes.length})
        </button>
        {ALL_CATEGORIES.map(cat => {
          const count = codes.filter(c => c.pbc_category === cat).length
          if (count === 0) return null
          const { label, color } = CATEGORY_LABELS[cat] || { label: cat, color: 'bg-gray-100 text-gray-700' }
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                selectedCategory === cat ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>

      {/* Code List by Category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <p>표시할 코드가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ALL_CATEGORIES.filter(cat => grouped[cat]?.length > 0).map(category => (
            <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Category Header */}
              <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CATEGORY_LABELS[category]?.color || 'bg-gray-100 text-gray-700'}`}>
                  {CATEGORY_LABELS[category]?.label || category}
                </span>
                <span className="text-sm text-gray-500 font-mono">{category}</span>
                <span className="ml-auto text-xs text-gray-400">{grouped[category].length}개</span>
              </div>

              {/* Code Rows */}
              <div className="divide-y">
                {grouped[category].map(code => (
                  <div key={code.pbc_code_id}>
                    <div
                      className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedCode(expandedCode === code.pbc_code_id ? null : code.pbc_code_id)}
                    >
                      <span className="font-mono text-sm font-semibold w-28 flex-shrink-0">{code.pbc_code}</span>
                      <span className="text-sm flex-1">{code.pbc_name}</span>
                      {code.pbc_name_en && (
                        <span className="text-xs text-gray-400 hidden lg:block max-w-xs truncate">{code.pbc_name_en}</span>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        {code.is_system ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded border border-blue-200">시스템</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded border border-green-200">펌 고유</span>
                        )}
                        {!code.is_system && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeactivate(code.pbc_code_id) }}
                            className="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50"
                          >
                            비활성화
                          </button>
                        )}
                        <span className="text-gray-300 text-xs">{expandedCode === code.pbc_code_id ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {expandedCode === code.pbc_code_id && (
                      <div className="px-6 py-4 bg-blue-50 border-t border-blue-100 text-sm text-gray-700 space-y-2">
                        {code.description && (
                          <div>
                            <span className="font-medium text-gray-600">설명: </span>
                            {code.description}
                          </div>
                        )}
                        {code.typical_documents && (
                          <div>
                            <span className="font-medium text-gray-600">제출 서류: </span>
                            {code.typical_documents}
                          </div>
                        )}
                        {!code.description && !code.typical_documents && (
                          <div className="text-gray-400">추가 정보 없음</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">PBC 코드 추가</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
                  <select
                    value={addForm.pbc_category}
                    onChange={e => setAddForm({ ...addForm, pbc_category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {ALL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_LABELS[cat]?.label || cat} ({cat})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">코드 *</label>
                  <input
                    type="text"
                    value={addForm.pbc_code}
                    onChange={e => setAddForm({ ...addForm, pbc_code: e.target.value.toUpperCase() })}
                    placeholder="예: CASH-006"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">코드명 (한국어) *</label>
                <input
                  type="text"
                  value={addForm.pbc_name}
                  onChange={e => setAddForm({ ...addForm, pbc_name: e.target.value })}
                  placeholder="예: 외화예금 잔액 확인서"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">코드명 (영어)</label>
                <input
                  type="text"
                  value={addForm.pbc_name_en}
                  onChange={e => setAddForm({ ...addForm, pbc_name_en: e.target.value })}
                  placeholder="예: Foreign Currency Deposit Confirmation"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={addForm.description}
                  onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제출 서류 형태</label>
                <input
                  type="text"
                  value={addForm.typical_documents}
                  onChange={e => setAddForm({ ...addForm, typical_documents: e.target.value })}
                  placeholder="예: 잔액증명서 원본"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {createError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{createError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setCreateError(null) }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {creating ? '추가 중...' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
