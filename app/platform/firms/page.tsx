'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Firm } from '@/lib/db/types'

interface CreateFirmForm {
  firm_name: string
  firm_code: string
  domain_prefix: string
  storage_strategy: 'SHARED' | 'PRIVATE'
}

export default function FirmsListPage() {
  const [firms, setFirms] = useState<Firm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<CreateFirmForm>({
    firm_name: '', firm_code: '', domain_prefix: '', storage_strategy: 'SHARED',
  })

  useEffect(() => { fetchFirms() }, [])

  async function fetchFirms() {
    try {
      setLoading(true)
      const res = await fetch('/api/platform/firms')
      const result = await res.json()
      if (result.success) setFirms(result.data || [])
      else setError(result.error?.message || '펌 목록 로드 실패')
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
      const res = await fetch('/api/platform/firms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (result.success) {
        setShowModal(false)
        setForm({ firm_name: '', firm_code: '', domain_prefix: '', storage_strategy: 'SHARED' })
        await fetchFirms()
      } else {
        setCreateError(result.error?.message || '생성 실패')
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">회계펌 목록</h2>
        <button onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + 새 펌 등록
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      ) : firms.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <p className="text-lg mb-2">등록된 회계펌이 없습니다</p>
          <p className="text-sm">"새 펌 등록" 버튼으로 첫 번째 펌을 만드세요</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">펌 코드</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">펌 이름</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">스토리지</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">상태</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">등록일</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {firms.map((firm) => (
                <tr key={firm.firm_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">{firm.firm_code}</td>
                  <td className="px-6 py-4 font-medium">{firm.firm_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      firm.storage_strategy === 'PRIVATE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {firm.storage_strategy === 'PRIVATE' ? 'BYOS' : '공유'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      firm.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>{firm.status}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {new Date(firm.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/platform/firms/${firm.firm_id}`} className="text-blue-600 hover:underline text-xs">
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
            <h3 className="text-lg font-bold mb-6">새 회계펌 등록</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">펌 이름 *</label>
                <input type="text" value={form.firm_name}
                  onChange={e => setForm({ ...form, firm_name: e.target.value })}
                  placeholder="예: 삼일회계법인" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">펌 코드 *</label>
                <input type="text" value={form.firm_code}
                  onChange={e => setForm({ ...form, firm_code: e.target.value.toUpperCase() })}
                  placeholder="예: SAMIL" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">영문 대문자, 고유값</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">도메인 프리픽스 *</label>
                <input type="text" value={form.domain_prefix}
                  onChange={e => setForm({ ...form, domain_prefix: e.target.value.toLowerCase() })}
                  placeholder="예: samil" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">스토리지 전략 *</label>
                <select value={form.storage_strategy}
                  onChange={e => setForm({ ...form, storage_strategy: e.target.value as 'SHARED' | 'PRIVATE' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="SHARED">SHARED — 플랫폼 공용 SharePoint</option>
                  <option value="PRIVATE">PRIVATE — 펌 자체 Microsoft 365 (BYOS)</option>
                </select>
              </div>
              {createError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{createError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setCreateError(null) }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium">
                  {creating ? '생성 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
