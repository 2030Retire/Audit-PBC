/**
 * Admin Request Item Detail Page
 * /admin/engagements/[engagementId]/request-items/[requestItemId]
 * Shows uploaded files, allows status change + comment
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RequestItem, RequestItemComment } from '@/lib/db/types'

interface FileWithUrl {
  request_item_file_id: string
  original_filename: string
  file_size_bytes: number
  mime_type: string | null
  upload_status: string
  upload_mode: string
  is_latest_version: boolean
  version_no: number
  uploaded_by: string | null
  uploaded_at: string | null
  created_at: string
  storage_provider_type: string
  download_url: string | null
}

interface DetailData {
  request_item: RequestItem
  files: FileWithUrl[]
  comments: RequestItemComment[]
}

const STATUS_OPTIONS = [
  { value: 'REQUESTED', label: '요청', color: 'bg-gray-100 text-gray-800' },
  { value: 'UPLOADED', label: '업로드됨', color: 'bg-blue-100 text-blue-800' },
  { value: 'UNDER_REVIEW', label: '검토중', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'APPROVED', label: '승인', color: 'bg-green-100 text-green-800' },
  { value: 'REJECTED', label: '반려', color: 'bg-red-100 text-red-800' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminRequestItemDetailPage() {
  const params = useParams()
  const engagementId = params.engagementId as string
  const requestItemId = params.requestItemId as string

  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Status change
  const [newStatus, setNewStatus] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [commentVisibility, setCommentVisibility] = useState<'CLIENT_VISIBLE' | 'INTERNAL_ONLY'>('CLIENT_VISIBLE')
  const [changingStatus, setChangingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Standalone comment
  const [standaloneComment, setStandaloneComment] = useState('')
  const [standaloneVisibility, setStandaloneVisibility] = useState<'CLIENT_VISIBLE' | 'INTERNAL_ONLY'>('CLIENT_VISIBLE')
  const [addingComment, setAddingComment] = useState(false)

  useEffect(() => {
    fetchDetail()
  }, [engagementId, requestItemId])

  async function fetchDetail() {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/engagements/${engagementId}/request-items/${requestItemId}`)
      const result = await res.json()
      if (result.success) {
        setDetail(result.data)
        setNewStatus(result.data.request_item.item_status)
      } else {
        setError(result.error?.message || '로드 실패')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault()
    if (!newStatus) return

    setChangingStatus(true)
    setStatusError(null)
    try {
      const res = await fetch(
        `/api/admin/engagements/${engagementId}/request-items/${requestItemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_status: newStatus,
            comment_body: commentBody || undefined,
            comment_visibility: commentVisibility,
          }),
        }
      )
      const result = await res.json()
      if (result.success) {
        setCommentBody('')
        await fetchDetail()
      } else {
        setStatusError(result.error?.message || '상태 변경 실패')
      }
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setChangingStatus(false)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!standaloneComment.trim()) return

    setAddingComment(true)
    try {
      const res = await fetch(
        `/api/admin/engagements/${engagementId}/request-items/${requestItemId}/comment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment_body: standaloneComment.trim(),
            visibility: standaloneVisibility,
          }),
        }
      )
      const result = await res.json()
      if (result.success) {
        setStandaloneComment('')
        await fetchDetail()
      }
    } catch {
      // silent
    } finally {
      setAddingComment(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>

  if (error || !detail) {
    return (
      <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
        {error || '요청 항목을 찾을 수 없습니다.'}{' '}
        <Link href={`/admin/engagements/${engagementId}`} className="underline font-semibold">돌아가기</Link>
      </div>
    )
  }

  const item = detail.request_item
  const currentStatusOption = STATUS_OPTIONS.find(s => s.value === item.item_status)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 flex items-center gap-1">
        <Link href="/admin/engagements" className="hover:text-blue-600">감사 목록</Link>
        <span>›</span>
        <Link href={`/admin/engagements/${engagementId}`} className="hover:text-blue-600">감사 상세</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">{item.doc_no}</span>
      </nav>

      {/* Item Info Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.doc_no}</span>
              {item.required_flag && (
                <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded">필수</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{item.item_title}</h2>
            {item.item_description && (
              <p className="text-gray-500 mt-1 text-sm">{item.item_description}</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${currentStatusOption?.color || 'bg-gray-100 text-gray-800'}`}>
            {currentStatusOption?.label || item.item_status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">마감일</p>
            <p className="font-medium">{item.due_date ? new Date(item.due_date).toLocaleDateString('ko-KR') : '-'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">업로드 파일</p>
            <p className="font-medium text-right">{item.uploaded_files_count.toLocaleString('ko-KR')}개</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">마지막 업로드</p>
            <p className="font-medium text-right">{item.last_uploaded_at ? formatDateTime(item.last_uploaded_at) : '-'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Files + Comments */}
        <div className="lg:col-span-2 space-y-6">

          {/* Uploaded Files */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-bold mb-4 text-gray-800">
              업로드된 파일
              <span className="ml-2 text-sm font-normal text-gray-400">({detail.files.length}개)</span>
            </h3>

            {detail.files.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">업로드된 파일이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {detail.files.map((file) => (
                  <div key={file.request_item_file_id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0">
                        {file.mime_type?.includes('pdf') ? '📄' :
                         file.mime_type?.includes('sheet') || file.mime_type?.includes('excel') ? '📊' :
                         file.mime_type?.includes('word') || file.mime_type?.includes('document') ? '📝' :
                         file.mime_type?.includes('image') ? '🖼️' : '📎'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.original_filename}</p>
                        <p className="text-xs text-gray-400">
                          {formatBytes(file.file_size_bytes)}
                          {file.uploaded_at && ` · ${formatDateTime(file.uploaded_at)}`}
                        </p>
                      </div>
                    </div>
                    {file.download_url ? (
                      <a
                        href={file.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 ml-3 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium"
                      >
                        다운로드
                      </a>
                    ) : (
                      <span className="flex-shrink-0 ml-3 text-xs text-gray-400 px-3 py-1.5">링크 없음</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments Thread */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-bold mb-4 text-gray-800">
              코멘트
              <span className="ml-2 text-sm font-normal text-gray-400">({detail.comments.length}개)</span>
            </h3>

            {detail.comments.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">코멘트가 없습니다</p>
            ) : (
              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {detail.comments.map((comment) => (
                  <div
                    key={comment.request_item_comment_id}
                    className={`p-3 rounded-lg border text-sm ${
                      comment.comment_visibility === 'INTERNAL_ONLY'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700 text-xs">
                          {comment.comment_type === 'FILE_UPLOAD' ? '📎' :
                           comment.comment_type === 'STATUS_CHANGE' ? '🔄' : '💬'}
                        </span>
                        {comment.comment_visibility === 'INTERNAL_ONLY' && (
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-medium">내부</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{formatDateTime(comment.created_at)}</span>
                    </div>
                    <p className="text-gray-700">{comment.comment_body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add standalone comment */}
            <form onSubmit={handleAddComment} className="space-y-2 pt-3 border-t">
              <textarea
                value={standaloneComment}
                onChange={(e) => setStandaloneComment(e.target.value)}
                placeholder="코멘트 입력..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <select
                  value={standaloneVisibility}
                  onChange={(e) => setStandaloneVisibility(e.target.value as 'CLIENT_VISIBLE' | 'INTERNAL_ONLY')}
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600"
                >
                  <option value="CLIENT_VISIBLE">고객 공개</option>
                  <option value="INTERNAL_ONLY">내부 전용</option>
                </select>
                <button
                  type="submit"
                  disabled={addingComment || !standaloneComment.trim()}
                  className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-1.5 rounded font-medium"
                >
                  {addingComment ? '추가 중...' : '코멘트 추가'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Status Change Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h3 className="text-base font-bold mb-4 text-gray-800">상태 변경</h3>
            <form onSubmit={handleStatusChange} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">새 상태</label>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                        newStatus === opt.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        value={opt.value}
                        checked={newStatus === opt.value}
                        onChange={() => setNewStatus(opt.value)}
                        className="text-blue-600"
                      />
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${opt.color}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">코멘트 (선택)</label>
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="상태 변경 사유..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <select
                  value={commentVisibility}
                  onChange={(e) => setCommentVisibility(e.target.value as 'CLIENT_VISIBLE' | 'INTERNAL_ONLY')}
                  className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 text-gray-600"
                >
                  <option value="CLIENT_VISIBLE">고객 공개</option>
                  <option value="INTERNAL_ONLY">내부 전용</option>
                </select>
              </div>

              {statusError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-xs">{statusError}</div>
              )}

              <button
                type="submit"
                disabled={changingStatus || newStatus === item.item_status}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {changingStatus ? '변경 중...' : newStatus === item.item_status ? '현재 상태' : '상태 변경'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
