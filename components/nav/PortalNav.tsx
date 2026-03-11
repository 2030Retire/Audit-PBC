'use client'

import Link from 'next/link'
import LogoutButton from '@/components/common/LogoutButton'

interface PortalNavProps {
  displayName?: string
}

export default function PortalNav({ displayName }: PortalNavProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Audit PBC</h1>
          <nav className="flex items-center gap-6">
            <Link href="/portal" className="text-blue-600 hover:text-blue-800 text-sm">내 요청 목록</Link>
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
