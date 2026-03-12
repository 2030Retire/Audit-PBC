/**
 * Client Portal - Request Item Detail + File Upload
 * /portal/[engagementId]/[requestItemId]
 * Shows request item details, uploaded files, and file upload area
 */

'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RequestItem, RequestItemComment } from '@/lib/db/types'

interface FileWithUrl {
  request_item_file_id: string
  original_filename: string
  file_size_bytes: number
  mime_type: string | null
  upload_status: string
  uploaded_at: string | null
  created_at: string
  download_url: string | null
}

interface DetailData {
  request_item: RequestItem
  files: FileWithUrl[]
  comments: RequestItemComment[]
}

const STATUS_LABELS: Record<string, { color: string; label: string }> = {
  REQUESTED: { color: 'bg-gray-100 text-gray-800', label: '요청' },
  UPLOADED: { color: 'bg-blue-100 text-blue-800', label: '업로드됨' },
  UNDER_REVIEW: { color: 'bg-yellow-100 text-yellow-800', label: '검토중' },
  APPROVED: { color: 'bg-green-100 text-green-800', label: '승인' },
  REJECTED: { color: 'bg-red-100 text-red-800', label: '반려' },
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

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

export default function PortalUploadPage() {
  const params = useParams()
  const engagementId = params.engagementId as string
  const requestItemId = params.requestItemId as string

  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  useEffect(() => {
    fetchDetail()
  }, [engagementId, requestItemId])

  async function fetchDetail() {
    try {
      setLoading(true)
      const res = await fetch(`/api/portal/requests/${requestItemId}`)
      const result = await res.json()
      if (result.success) {
        setDetail(result.data)
      } else {
        setError(result.error?.message || '요청 항목 로드 실패')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('파일 크기는 최대 50MB입니다')
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)
    setUploadProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', file)

      setUploadProgress(30)

      const res = await fetch(`/api/portal/requests/${requestItemId}/upload`, {
        method: 'POST',
        body: formData,
      })

      setUploadProgress(80)

      const result = await res.json()

      if (result.success) {
        setUploadProgress(100)
        setUploadSuccess(`"${file.name}" 업로드 완료!`)
        await fetchDetail()
        setTimeout(() => {
          setUploadSuccess(null)
          setUploadProgress(0)
        }, 3000)
      } else {
        setUploadError(result.error?.message || '업로드 실패')
        setUploadProgress(0)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '업로드 중 오류 발생')
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }, [requestItemId])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    e.target.value = ''
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return

    setAddingComment(true)
    try {
      const res = await fetch(`/api/portal/requests/${requestItemId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_body: commentText.trim() }),
      })
      const result = await res.json()
      if (result.success) {
        setCommentText('')
        await fetchDetail()
      }
    } catch {
      // silent
    } finally {
      setAddingComment(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>

  if (!detail) {
    return (
      <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
        요청 항목을 찾을 수 없습니다.{' '}
        <Link href="/portal" className="underline font-semibold">요청 목록으로</Link>
      </div>
    )
  }

  const item = detail.request_item
  const statusBadge = STATUS_LABELS[item.item_status] || STATUS_LABELS.REQUESTED
  const canUpload = item.item_status !== 'APPROVED'

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/portal" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← 요청 목록
      </Link>

      {/* Request Item Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.doc_no}</span>
            <h2 className="text-xl font-bold mt-1">{item.item_title}</h2>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>

        {item.item_description && (
          <p className="text-gray-600 text-sm mb-4 p-3 bg-gray-50 rounded">{item.item_description}</p>
        )}

        <div className="flex gap-6 text-sm">
          {item.due_date && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">마감일</p>
              <p className="font-medium">{new Date(item.due_date).toLocaleDateString('ko-KR')}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">업로드 파일</p>
            <p className="font-medium text-right">{item.uploaded_files_count.toLocaleString('ko-KR')}개</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">필수 여부</p>
            <p className={`font-medium ${item.required_flag ? 'text-red-600' : 'text-gray-600'}`}>
              {item.required_flag ? '필수' : '선택'}
            </p>
          </div>
        </div>

        {item.item_status === 'REJECTED' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ 이 항목이 반려되었습니다. 아래에서 파일을 다시 업로드해 주세요.
          </div>
        )}
        {item.item_status === 'APPROVED' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            ✅ 이 항목이 승인되었습니다.
          </div>
        )}
      </div>

      {/* Uploaded Files */}
      {detail.files.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-base font-bold mb-4">업로드된 파일</h3>
          <div className="space-y-2">
            {detail.files.map((file) => (
              <div key={file.request_item_file_id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">
                    {file.mime_type?.includes('pdf') ? '📄' :
                     file.mime_type?.includes('sheet') || file.mime_type?.includes('excel') ? '📊' :
                     file.mime_type?.includes('word') ? '📝' :
                     file.mime_type?.includes('image') ? '🖼️' : '📎'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.original_filename}</p>
                    <p className="text-xs text-gray-400">
                      {formatBytes(file.file_size_bytes)}
                      {file.uploaded_at && ` · ${formatDateTime(file.uploaded_at)}`}
                    </p>
                  </div>
                </div>
                {file.download_url && (
                  <a
                    href={file.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 ml-3 text-xs text-blue-600 hover:underline font-medium"
                  >
                    다운로드
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Upload */}
      {canUpload && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-base font-bold mb-4">
            {detail.files.length > 0 ? '파일 추가 업로드' : '파일 업로드'}
          </h3>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>
          )}
          {uploadError && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">{uploadError}</div>
          )}
          {uploadSuccess && (
            <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded mb-4 text-sm">
              ✅ {uploadSuccess}
            </div>
          )}

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                : uploading
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleInputChange}
              disabled={uploading}
              className="hidden"
            />

            {uploading ? (
              <div>
                <div className="text-3xl mb-3">⏳</div>
                <p className="text-gray-600 font-medium mb-3">업로드 중...</p>
                <div className="w-48 mx-auto h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="text-3xl mb-3">📂</div>
                <p className="text-gray-700 font-medium mb-1">파일을 드래그하거나 클릭하세요</p>
                <p className="text-xs text-gray-400">PDF, Excel, Word, 이미지 등 (최대 50MB)</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments / Messages */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-base font-bold mb-4">
          메시지
          {detail.comments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">({detail.comments.length}개)</span>
          )}
        </h3>

        {detail.comments.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">메시지가 없습니다</p>
        ) : (
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
            {detail.comments.map((comment) => (
              <div
                key={comment.request_item_comment_id}
                className={`p-3 rounded-lg text-sm ${
                  comment.comment_type === 'FILE_UPLOAD'
                    ? 'bg-blue-50 border border-blue-100'
                    : comment.comment_type === 'STATUS_CHANGE'
                    ? 'bg-yellow-50 border border-yellow-100'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">
                    {comment.comment_type === 'FILE_UPLOAD' ? '📎 파일 업로드' :
                     comment.comment_type === 'STATUS_CHANGE' ? '🔄 상태 변경' : '💬 메시지'}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateTime(comment.created_at)}</span>
                </div>
                <p className="text-gray-700">{comment.comment_body}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddComment} className="flex gap-2 pt-3 border-t">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={addingComment || !commentText.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {addingComment ? '...' : '전송'}
          </button>
        </form>
      </div>
    </div>
  )
}
