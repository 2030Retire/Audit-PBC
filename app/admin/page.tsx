/**
 * Firm Admin Dashboard
 * /admin
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeEngagements: 0,
    pendingRequests: 0,
  })

  useEffect(() => {
    // TODO: Fetch stats from API
  }, [])

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Admin Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">Total Companies</h3>
          <p className="text-3xl font-bold mt-2">{stats.totalCompanies}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">
            Active Engagements
          </h3>
          <p className="text-3xl font-bold mt-2">{stats.activeEngagements}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">
            Pending Requests
          </h3>
          <p className="text-3xl font-bold mt-2">{stats.pendingRequests}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <Link
            href="/admin/companies"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            View Companies
          </Link>
          <Link
            href="/admin/engagements"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            View Engagements
          </Link>
        </div>
      </div>
    </div>
  )
} 