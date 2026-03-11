/**
 * Firm Admin Settings Page
 * /admin/settings
 * - Engagement code pattern configuration
 * - Default due days
 */

'use client'

import React, { useEffect, useState } from 'react'

interface FirmSettings {
  engagement_code_pattern: string
  engagement_seq_per_company: boolean
  default_due_days: number
  timezone: string
  locale: string
}

const PATTERN_VARS = [
  { var: '{COMPANY_CODE}', desc: '고객사 코드 (대문자)', example: 'SAMSUNG' },
  { var: '{YEAR}', desc: '회계연도 4자리', example: '2025' },
  { var: '{YEAR2}', desc: '회계연도 2자리', example: '25' },
  { var: '{SEQ}', desc: '순번 (패딩 없음)', example: '1' },
  { var: '{SEQ2}', desc: '순번 (2자리 0패딩)', example: '01' },
  { var: '{SEQ3}', desc: '순번 (3자리 0패딩)', example: '001' },
]

const PRESET_PATTERNS = [
  { label: '기본 ({COMPANY_CODE}-{YEAR}-{SEQ3})', value: '{COMPANY_CODE}-{YEAR}-{SEQ3}', example: 'SAMSUNG-2025-001' },
  { label: '연도-고객사 ({YEAR}-{COMPANY_CODE}-{SEQ2})', value: '{YEAR}-{COMPANY_CODE}-{SEQ2}', example: '2025-SAMSUNG-01' },
  { label: '연도 단축+고객사 ({YEAR2}{COMPANY_CODE}{SEQ3})', value: '{YEAR2}{COMPANY_CODE}{SEQ3}', example: '25SAMSUNG001' },
  { label: '고객사/연도/순번 ({COMPANY_CODE}/{YEAR}/{SEQ})', value: '{COMPANY_CODE}/{YEAR}/{SEQ}', example: 'SAMSUNG/2025/1' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<FirmSettings>({
    engagement_code_pattern: '{COMPANY_CODE}-{YEAR}-{SEQ3}',
    engagement_seq_per_company: true,
    default_due_days: 30,
    timezone: 'Asia/Seoul',
    locale: 'ko-KR',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [patternPreview, setPatternPreview] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  useEffect(() => {
    // Preview pattern substitution
    const preview = settings.engagement_code_pattern
      .replace('{COMPANY_CODE}', 'ACMECO')
      .replace('{YEAR}', '2025')
      .replace('{YEAR2}', '25')
      .replace('{SEQ}', '3')
      .replace('{SEQ2}', '03')
      .replace('{SEQ3}', '003')
    setPatternPreview(preview)
  }, [settings.engagement_code_pattern])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings')
      const result = await res.json()
      if (result.success) setSettings(result.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const result = await res.json()
      if (result.success) {
        setSaveMsg({ type: 'success', text: '설정이 저장되었습니다' })
      } else {
        setSaveMsg({ type: 'error', text: result.error?.message || '저장 실패' })
      }
    } catch (e) {
      setSaveMsg({ type: 'error', text: e instanceof Error ? e.message : '오류 발생' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold">펌 설정</h2>
        <p className="text-sm text-gray-500 mt-1">감사 코드 패턴 및 기본 설정을 관리합니다</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Engagement Code Pattern */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold text-gray-800 mb-4">감사 코드 자동 생성</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">코드 패턴</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.engagement_code_pattern}
                onChange={e => setSettings({ ...settings, engagement_code_pattern: e.target.value })}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {patternPreview && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                <span className="text-gray-500">미리보기: </span>
                <span className="font-mono font-bold text-blue-800">{patternPreview}</span>
                <span className="text-xs text-gray-400 ml-2">(고객사코드: ACMECO, 연도: 2025, 순번: 3)</span>
              </div>
            )}
          </div>

          {/* Preset Patterns */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2">프리셋 패턴 선택</label>
            <div className="space-y-2">
              {PRESET_PATTERNS.map(preset => (
                <label key={preset.value} className={`flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                  settings.engagement_code_pattern === preset.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    checked={settings.engagement_code_pattern === preset.value}
                    onChange={() => setSettings({ ...settings, engagement_code_pattern: preset.value })}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-700">{preset.label}</span>
                    <span className="text-xs text-gray-400 ml-2">→ 예: {preset.example}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Pattern Variables Reference */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">사용 가능한 변수</p>
            <div className="space-y-1">
              {PATTERN_VARS.map(v => (
                <div key={v.var} className="flex items-center gap-3 text-xs">
                  <code className="font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded text-blue-700 w-32 flex-shrink-0">{v.var}</code>
                  <span className="text-gray-600">{v.desc}</span>
                  <span className="text-gray-400 ml-auto">예: {v.example}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sequence Scope */}
          <div className="mt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.engagement_seq_per_company}
                onChange={e => setSettings({ ...settings, engagement_seq_per_company: e.target.checked })}
                className="rounded text-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">고객사별 순번 관리</p>
                <p className="text-xs text-gray-400">체크 시: 각 고객사마다 별도 순번 관리 (A사: 001, 002... / B사: 001, 002...)</p>
                <p className="text-xs text-gray-400">미체크 시: 전체 펌 기준 통합 순번 관리</p>
              </div>
            </label>
          </div>
        </div>

        {/* Default Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold text-gray-800 mb-4">기본값 설정</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기본 마감일 (요청 후 N일 이내)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.default_due_days}
                  onChange={e => setSettings({ ...settings, default_due_days: parseInt(e.target.value, 10) })}
                  min={1}
                  max={365}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">일</span>
              </div>
            </div>
          </div>
        </div>

        {saveMsg && (
          <div className={`px-4 py-3 rounded text-sm ${
            saveMsg.type === 'success' ? 'bg-green-50 border border-green-300 text-green-700' : 'bg-red-50 border border-red-300 text-red-700'
          }`}>
            {saveMsg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
