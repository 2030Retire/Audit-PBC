/**
 * Next.js Middleware
 * Handles authentication, session validation, and routing
 * Uses @supabase/ssr for server-side auth
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Env var guard — fail open so the site is reachable even if misconfigured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[middleware] Missing Supabase env vars')
    return res
  }

  let session = null
  try {
    // Create Supabase client for middleware
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Get session
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch (err) {
    console.error('[middleware] Supabase session error:', err)
    // Fail open — let route handlers deal with auth
    return res
  }

  const pathname = req.nextUrl.pathname

  // Public routes - no auth required
  const publicRoutes = ['/login', '/page', '/public']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (isPublicRoute) {
    // If logged in and visiting login, redirect to appropriate dashboard
    if (session) {
      const userRole = session.user?.user_metadata?.role || 'client'
      const firmId = session.user?.user_metadata?.firm_id

      if (pathname === '/login') {
        if (userRole === 'platform_admin') {
          return NextResponse.redirect(new URL('/platform', req.url))
        } else if (userRole === 'firm_admin' || userRole === 'firm_staff') {
          return NextResponse.redirect(new URL('/admin', req.url))
        } else if (userRole === 'client') {
          return NextResponse.redirect(
            new URL(`/portal/${firmId}`, req.url)
          )
        }
      }
    }

    return res
  }

  // Protected routes - auth required
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Route-based access control
  const userRole = session.user?.user_metadata?.role || 'client'
  const firmId = session.user?.user_metadata?.firm_id

  // Platform routes - platform_admin only
  if (pathname.startsWith('/platform')) {
    if (userRole !== 'platform_admin') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // Admin routes - firm_admin or firm_staff
  if (pathname.startsWith('/admin')) {
    if (!['firm_admin', 'firm_staff'].includes(userRole)) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // Portal routes - client_user
  if (pathname.startsWith('/portal')) {
    if (userRole !== 'client') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // API routes - authorization happens in individual route handlers
  // Middleware just ensures session exists for /api routes
  if (pathname.startsWith('/api')) {
    // Session is attached to request headers for API handlers
    // Handlers will validate firm_id and role
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 