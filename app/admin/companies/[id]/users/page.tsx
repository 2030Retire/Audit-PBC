/**
 * Company Client User Management
 * /admin/companies/[id]/users
 * 특정 고객사의 클라이언트 사용자 목록 조회 및 초대
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface ClientUser {
  user_id: string
  email: string
  display_name: string
  user_type: string
  status: string
  created_at: string
  last_login_at: string | null
  company_id: string | null
  companies?: {
    company_id: string
    company_code: string
    company_name: string
  } | null
}

interface NewUserResult {
  email: string
  display_name: string
  temp_password: string
  company_name: string
}

export default function CompanyUsersPage() {
  const params = useParams()
  const companyId = params.id as string

  const [users, setUsers] = useState<ClientUser[]>([])
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', display_name: '' })

  // Success: show temp password
  const [newUserResult, setNewUserResult] = useState<NewUserResult | null>(null)
  const [copied, setCopied] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [companyId])

  async function fetchUsers() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users')
      const result = await res.json()
      if (result.success) {
        // Filter by this company
        const allUsers: ClientUser[] = result.data || []
        const companyUsers = allUsers.filter(
          (u) => u.company_id === companyId && u.user_type === 'CLIENT_USER'
        )
        setUsers(companyUsers)
        // Find company name
        const anyUser = allUsers.find((u) => u.company_id === companyId)
        if (anyUser?.companies?.company_name) {
          setCompanyName(anyUser.companies.company_name)
        }
      } else {
        setError(result.error?.message || '사용자 목록 로드 실패')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.display_name.trim()) return

    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          display_name: form.display_name.trim(),
          company_id: companyId,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setShowModal(false)
        setForm({ email: '', display_name: '' })
        setNewUserResult({
          email: form.email.trim(),
          display_name: form.display_name.trim(),
          temp_password: result.data.temp_password,
          company_name: result.data.company_name,
        })
        setCopied(false)
        await fetchUsers()
      } else {
        setCreateError(result.error?.message || '생성 실패')
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('이 사용자를 비활성화하시겠습니까? 로그인이 즉시 차단됩니다.')) return

    setDeletingId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const result = await res.json()
      if (result.success) {
        await fetchUsers()
      } else {
        alert(result.error?.message || '삭제 실패')
      }
    } catch {
      alert('오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  function copyCredentials() {
    if (!newUserResult) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const text = `이메일: ${newUserResult.email}\n임시 비밀번호: ${newUserResult.temp_password}\n로그인 URL: ${origin}/login`
    navigator.clipboard.writeText(text).then(() => setCopied(true))
    setTimeout(() => setCopied(false), 3000)
  }

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 flex items-center gap-1">
        <Link href="/admin/companies" className="hover:text-blue-600">고객사 목록</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">{companyName || '고객사'} 담당자 관리</span>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">담당자 계정 관리</h2>
          {companyName && (
            <p className="text-sm text-gray-500 mt-0.5">{companyName} · {users.length}명</p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + 담당자 초대
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>
      )}

      {/* Temp password result card */}
      {newUserResult && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-blue-900 mb-2">✅ 계정이 생성되었습니다</h3>
              <p className="text-sm text-blue-700 mb-3">
                아래 로그인 정보를 <strong>{newUserResult.display_name}</strong>님께 안전하게 전달하세요.
                이 임시 비밀번호는 한 번만 표시됩니다.
              </p>
              <div className="bg-white border border-blue-200 rounded-lg p-4 font-mono text-sm space-y-2">
                <div className="flex gap-3">
                  <span className="text-gray-400 w-28 flex-shrink-0">이메일</span>
                  <span className="font-medium">{newUserResult.email}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-400 w-28 flex-shrink-0">임시 비밀번호</span>
                  <span className="font-bold text-red-700 tracking-widest text-lg">{newUserResult.temp_password}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-400 w-28 flex-shrink-0">로그인 URL</span>
                  <span className="text-blue-700 text-xs">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/login
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setNewUserResult(null)}
              className="text-blue-400 hover:text-blue-600 text-xl ml-4 flex-shrink-0"
            >
              ✕
            </button>
          </div>
          <div className="mt-4">
            <button
              onClick={copyCredentials}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              {copied ? '✅ 복사됨!' : '📋 로그인 정보 복사'}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      {users.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">👤</div>
          <p className="text-lg mb-2">등록된 담당자가 없습니다</p>
          <p className="text-sm mb-4">이 고객사에 접근할 수 있는 담당자를 초대하세요</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-600 hover:underline text-sm"
          >
            + 담당자 초대하기 →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">이름</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">이메일</th>
                <th className="px-6 py-3 text-center font-semibold text-gray-700">상태</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-700">마지막 로그인</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-700">등록일</th>
                <th className="px-6 py-3 text-center font-semibold text-gray-700">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{user.display_name}</td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      user.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.status === 'ACTIVE' ? '활성' : user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-gray-500">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString('ko-KR', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })
                      : '미접속'}
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleDelete(user.user_id)}
                      disabled={deletingId === user.user_id}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:text-gray-300"
                    >
                      {deletingId === user.user_id ? '처리 중...' : '비활성화'}
                    </button>
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
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">담당자 초대</h3>
            <p className="text-sm text-gray-500 mb-6">
              생성 후 임시 비밀번호가 표시됩니다. 담당자에게 직접 전달해 주세요.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="예: 홍길동"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="예: hong@company.com"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {createError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{createError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setCreateError(null)
                    setForm({ email: '', display_name: '' })
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
                  {creating ? '생성 중...' : '계정 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
