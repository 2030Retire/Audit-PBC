/**
 * Platform Admin Dashboard
 * /platform
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PlatformDashboard() {
  const [stats, setStats] = useState({
    totalFirms: 0,
    activeStorageConfigs: 0,
    recentProvisioningJobs: 0,
  })

  useEffect(() => {
    // TODO: Fetch stats from API
  }, [])

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Platform Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">Total Firms</h3>
          <p className="text-3xl font-bold mt-2">{stats.totalFirms}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">
            Active Storage Configs
          </h3>
          <p className="text-3xl font-bold mt-2">{stats.activeStorageConfigs}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">
            Recent Provisioning Jobs
          </h3>
          <p className="text-3xl font-bold mt-2">{stats.recentProvisioningJobs}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <Link
            href="/platform/firms"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            View All Firms
          </Link>
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
            Create New Firm
          </button>
        </div>
      </div>
    </div>
  )
}
