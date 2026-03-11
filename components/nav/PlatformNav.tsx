'use client'

import Link from 'next/link'
import LogoutButton from '@/components/common/LogoutButton'

interface PlatformNavProps {
  displayName?: string
}

export default function PlatformNav({ displayName }: PlatformNavProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Audit PBC — Platform Admin</h1>
          <nav className="flex items-center gap-6">
            <Link href="/platform" className="text-blue-600 hover:text-blue-800 text-sm">대시보드</Link>
            <Link href="/platform/firms" className="text-blue-600 hover:text-blue-800 text-sm">회계펌 관리</Link>
            {displayName && (
              <span className="text-gray-500 text-sm">{displayName}</span>
            )}
            <LogoutButton />
          </nav>
        </div>
      </div>
    </header>
  )
}
