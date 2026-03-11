import React from 'react'
import { requireRole } from '@/lib/supabase/server'
import PlatformNav from '@/components/nav/PlatformNav'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // platform_admin만 접근 가능
  const user = await requireRole(['platform_admin'])

  return (
    <div className="min-h-screen bg-gray-100">
      <PlatformNav
        displayName={user.user_metadata?.display_name || user.email}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
