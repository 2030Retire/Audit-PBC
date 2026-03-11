/**
 * Next.js Middleware
 * Lightweight cookie-based routing — no Supabase client in Edge Runtime.
 * Actual auth validation happens in individual route handlers via getSession().
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Supabase stores the session in a cookie named sb-<project-ref>-auth-token
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
  : ''

function hasSession(req: NextRequest): boolean {
  // Check both possible Supabase cookie names
  const cookieName = `sb-${PROJECT_REF}-auth-token`
  const legacyCookieName = `sb-${PROJECT_REF}-auth-token.0`
  return (
    req.cookies.has(cookieName) ||
    req.cookies.has(legacyCookieName) ||
    req.cookies.has('supabase-auth-token')
  )
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const loggedIn = hasSession(req)

  // Public routes — no auth required
  const publicPaths = ['/login', '/api/auth', '/api/setup-admin', '/public']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  // Static / Next.js internals are excluded via config.matcher below
  if (isPublic) {
    // If already logged in, redirect away from /login
    if (loggedIn && pathname === '/login') {
      return NextResponse.redirect(new URL('/admin', req.url))
    }
    return NextResponse.next()
  }

  // Root — redirect based on login state
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(loggedIn ? '/admin' : '/login', req.url)
    )
  }

  // Protected — require session cookie
  if (!loggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
