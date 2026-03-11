'use client'

import React from 'react'
import Link from 'next/link'
import LogoutButton from '@/components/common/LogoutButton'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">Audit PBC — Firm Admin</h1>
            <nav className="flex items-center gap-6">
              <Link href="/admin" className="text-blue-600 hover:text-blue-800 text-sm">대시보드</Link>
              <Link href="/admin/companies" className="text-blue-600 hover:text-blue-800 text-sm">고객사</Link>
              <Link href="/admin/engagements" className="text-blue-600 hover:text-blue-800 text-sm">감사</Link>
              <Link href="/admin/templates" className="text-blue-600 hover:text-blue-800 text-sm">템플릿</Link>
              <Link href="/admin/pbc-codes" className="text-blue-600 hover:text-blue-800 text-sm">PBC 코드</Link>
              <Link href="/admin/settings" className="text-blue-600 hover:text-blue-800 text-sm">설정</Link>
              <Link href="/admin/users" className="text-blue-600 hover:text-blue-800 text-sm">사용자</Link>
              <LogoutButton />
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
