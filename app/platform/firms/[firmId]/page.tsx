'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Firm, StorageConfig } from '@/lib/db/types'

type Tab = 'info' | 'users'

interface FirmUser {
  user_id: string
  email: string
  role: string
  display_name: string
  created_at: string
  last_sign_in_at: string | null
}

export default function FirmDetailPage() {
  const params = useParams()
  const firmId = params.firmId as string

  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [firm, setFirm] = useState<Firm | null>(null)
  const [storageConfig, setStorageConfig] = useState<StorageConfig | null>(null)
  const [users, setUsers] = useState<FirmUser[]>([])
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ firm_name: '', status: 'ACTIVE' })

  // Create user modal
  const [showUserModal, setShowUserModal] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', display_name: '', role: 'firm_admin' })
  const [creatingUser, setCreatingUser] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [userSuccess, setUserSuccess] = useState<string | null>(null)

  useEffect(() => { fetchFirm() }, [firmId])
  useEffect(() => { if (activeTab === 'users') fetchUsers() }, [activeTab])

  async function fetchFirm() {
    try {
      setLoading(true)
      const res = await fetch(`/api/platform/firms/${firmId}`)
      const result = await res.json()
      if (result.success) {
        setFirm(result.data.firm)
        setStorageConfig(result.data.storage_config)
        setForm({ firm_name: result.data.firm.firm_name, status: result.data.firm.status })
      } else {
        setError(result.error?.message || '로드 실패')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    } finally {
      setLoading(false)
    }
  }

  async function fetchUsers() {
    setUsersLoading(true)
    try {
      const res = await fetch(`/api/platform/firms/${firmId}/users`)
      const result = await res.json()
      if (result.success) setUsers(result.data || [])
    } finally {
      setUsersLoading(false)
    }
  }

  async function handleUpdate() {
    setSaving(true)
    try {
      const res = await fetch(`/api/platform/firms/${firmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (result.success) { setEditing(false); await fetchFirm() }
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setCreatingUser(true)
    setUserError(null)
    setUserSuccess(null)
    try {
      const res = await fetch(`/api/platform/firms/${firmId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
      const result = await res.json()
      if (result.success) {
        setUserSuccess(`✅ ${userForm.email} 계정 생성 완료`)
        setUserForm({ email: '', password: '', display_name: '', role: 'firm_admin' })
        await fetchUsers()
      } else {
        setUserError(result.error?.message || '생성 실패')
      }
    } catch (e) {
      setUserError(e instanceof Error ? e.message : '오류')
    } finally {
      setCreatingUser(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>
  if (!firm) return (
    <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
      펌을 찾을 수 없습니다. <Link href="/platform/firms" className="underline">목록으로</Link>
    </div>
  )

  return (
    <div>
      <Link href="/platform/firms" className="text-blue-600 hover:underline text-sm mb-4 inline-block">← 펌 목록</Link>

      <div className="flex items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">{firm.firm_name}</h2>
          <p className="text-gray-500 text-sm font-mono">{firm.firm_code} · {firmId}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${firm.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {firm.status}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${firm.storage_strategy === 'PRIVATE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
          {firm.storage_strategy === 'PRIVATE' ? 'BYOS' : '공유'}
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-0">
          {([['info', '펌 정보'], ['users', '사용자 관리']] as [Tab, string][]).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: 펌 정보 */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">기본 정보</h3>
              {!editing && <button onClick={() => setEditing(true)} className="text-blue-600 text-sm hover:underline">수정</button>}
            </div>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">펌 이름</label>
                  <input type="text" value={form.firm_name} onChange={e => setForm({ ...form, firm_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="ACTIVE">활성</option>
                    <option value="INACTIVE">비활성</option>
                    <option value="SUSPENDED">정지</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">취소</button>
                  <button onClick={handleUpdate} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:bg-blue-300">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-4">
                {[
                  ['펌 코드', firm.firm_code],
                  ['펌 이름', firm.firm_name],
                  ['도메인 프리픽스', firm.domain_prefix],
                  ['청구 상태', firm.billing_status],
                  ['타임존', firm.default_timezone],
                  ['등록일', new Date(firm.created_at).toLocaleDateString('ko-KR')],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-4">
                    <dt className="text-sm text-gray-500 w-32 shrink-0">{label}</dt>
                    <dd className="text-sm font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-bold mb-4">스토리지 설정</h3>
            {storageConfig ? (
              <div className="space-y-3 text-sm">
                <div><p className="text-gray-500">연결 상태</p>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${storageConfig.connection_status === 'CONNECTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {storageConfig.connection_status}
                  </span>
                </div>
                <div><p className="text-gray-500">프로비저닝</p>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${storageConfig.provisioning_status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {storageConfig.provisioning_status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">스토리지 설정 없음<br/><span className="text-xs">BYOS 펌은 연결 설정 필요</span></p>
            )}
          </div>
        </div>
      )}

      {/* Tab: 사용자 관리 */}
      {activeTab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">펌 사용자 목록</h3>
            <button onClick={() => setShowUserModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + 사용자 추가
            </button>
          </div>

          {usersLoading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : users.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
              <p className="mb-2">등록된 사용자가 없습니다</p>
              <p className="text-sm">"사용자 추가" 버튼으로 Firm Admin 또는 Staff 계정을 만드세요</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">이름</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">이메일</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">역할</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">마지막 로그인</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map(u => (
                    <tr key={u.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{u.display_name}</td>
                      <td className="px-6 py-4 text-gray-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${u.role === 'firm_admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                          {u.role === 'firm_admin' ? 'Firm Admin' : 'Staff'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ko-KR') : '없음'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Create User Modal */}
          {showUserModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
                <h3 className="text-lg font-bold mb-2">사용자 추가</h3>
                <p className="text-sm text-gray-500 mb-6">
                  <span className="font-semibold text-gray-700">{firm.firm_name}</span> 펌의 새 계정을 생성합니다
                </p>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">역할 *</label>
                    <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="firm_admin">Firm Admin — 모든 기능</option>
                      <option value="firm_staff">Staff — 고객사/감사 조회 및 검토</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                    <input type="text" value={userForm.display_name}
                      onChange={e => setUserForm({ ...userForm, display_name: e.target.value })}
                      placeholder="홍길동"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
                    <input type="email" value={userForm.email}
                      onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                      placeholder="admin@example.com" required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">임시 비밀번호 *</label>
                    <input type="password" value={userForm.password}
                      onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="최소 6자리" required minLength={6}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p className="text-xs text-gray-400 mt-1">사용자에게 별도 안내 필요 (이메일 발송 기능은 추후 추가)</p>
                  </div>
                  {userError && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">{userError}</div>}
                  {userSuccess && <div className="bg-green-50 border border-green-300 text-green-700 px-3 py-2 rounded text-sm">{userSuccess}</div>}
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => { setShowUserModal(false); setUserError(null); setUserSuccess(null) }}
                      className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">닫기</button>
                    <button type="submit" disabled={creatingUser}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium">
                      {creatingUser ? '생성 중...' : '계정 생성'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
