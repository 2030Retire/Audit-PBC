import React from 'react'
import { requireAuth } from '@/lib/supabase/server'
import PortalNav from '@/components/nav/PortalNav'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // 로그인만 확인 (역할 제한 없음 — client, firm_staff 모두 가능)
  const user = await requireAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalNav
        displayName={user.user_metadata?.display_name || user.email}
      />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
