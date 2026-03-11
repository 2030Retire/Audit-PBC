import React from 'react'
import { requireRole } from '@/lib/supabase/server'
import AdminNav from '@/components/nav/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 인증 + 역할 확인 — 실패 시 /login 으로 자동 리다이렉트
  const user = await requireRole(['firm_admin', 'firm_staff', 'platform_admin'])

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNav
        displayName={user.user_metadata?.display_name || user.email}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
