/**
 * Client Portal - Upload Page
 * /portal/[engagementId]/[requestItemId]
 * Shows request item details and file upload area
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RequestItem, RequestItemComment } from '@/lib/db/types'

interface RequestItemDetail {
  request_item: RequestItem
  comments: RequestItemComment[]
}

export default function UploadPage() {
  const params = useParams()
  const engagementId = params.engagementId as string
  const requestItemId = params.requestItemId as string

  const [detail, setDetail] = useState<RequestItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  useEffect(() => {
    fetchDetail()
  }, [engagementId, requestItemId])

  async function fetchDetail() {
    try {
      setLoading(true)
      const res = await fetch(
        `/api/admin/engagements/${engagementId}/request-items/${requestItemId}`
      )
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

  async function handleFileSelect(file: File) {
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      // Get request item to find company_id
      const res = await fetch(
        `/api/admin/engagements/${engagementId}/request-items/${requestItemId}`
      )
      const result = await res.json()
      const requestItem = result.data?.request_item

      if (!requestItem) {
        throw new Error('요청 항목을 찾을 수 없습니다')
      }

      // Initiate upload
      const uploadRes = await fetch('/api/upload/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          mime_type: file.type,
          request_item_id: requestItemId,
          engagement_id: engagementId,
          company_id: requestItem.company_id,
        }),
      })

      const uploadResult = await uploadRes.json()

      if (uploadResult.success) {
        setUploadError(null)
        // Reset and show success
        setCommentText('')
        await fetchDetail()
      } else {
        setUploadError(uploadResult.error?.message || '업로드 시작 실패')
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '오류 발생')
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">로딩 중...</div>
    )
  }

  if (!detail) {
    return (
      <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
        요청 항목을 찾을 수 없습니다.{' '}
        <Link href="/portal" className="underline font-semibold">
          요청 목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const item = detail.request_item

  return (
    <div>
      <Link href="/portal" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        요청 목록으로
      </Link>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-600">Doc No</p>
            <p className="text-lg font-bold">{item.doc_no}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">항목명</p>
            <p className="text-lg font-bold">{item.item_title}</p>
          </div>
        </div>

        {item.item_description && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">설명</p>
            <p className="text-gray-700">{item.item_description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">마감일</p>
            <p className="text-lg font-bold">
              {item.due_date
                ? new Date(item.due_date).toLocaleDateString('ko-KR')
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">필수 여부</p>
            <p className="text-lg font-bold">
              {item.required_flag ? '필수' : '선택'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">파일 업로드</h3>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {uploadError && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {uploadError}
          </div>
        )}

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50'
          }`}
        >
          <div className="mb-4">
            <svg
              className="mx-auto w-12 h-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-10-6v10m0 0l-3-3m3 3l3-3"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-gray-700 font-medium mb-2">
            파일을 드래그하거나 클릭하세요
          </p>
          <p className="text-sm text-gray-500 mb-4">
            (최대 10MB)
          </p>

          <input
            type="file"
            onChange={handleInputChange}
            disabled={uploading}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input">
            <button
              type="button"
              onClick={() => document.getElementById('file-input')?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium inline-block cursor-pointer"
            >
              {uploading ? '업로드 중...' : '파일 선택'}
            </button>
          </label>
        </div>

        {item.uploaded_files_count > 0 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              업로드된 파일: <strong>{item.uploaded_files_count}개</strong>
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">코멘트</h3>

        {detail.comments.length === 0 ? (
          <p className="text-gray-400 text-sm mb-6">코멘트가 없습니다</p>
        ) : (
          <div className="mb-6 space-y-4 max-h-96 overflow-y-auto">
            {detail.comments.map((comment) => (
              <div
                key={comment.request_item_comment_id}
                className="bg-gray-50 rounded p-4 border border-gray-200"
              >
                <div className="flex justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">
                    {comment.comment_visibility === 'INTERNAL_ONLY'
                      ? '(내부 코멘트)'
                      : '코멘트'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(comment.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                <p className="text-sm text-gray-700">{comment.comment_body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
