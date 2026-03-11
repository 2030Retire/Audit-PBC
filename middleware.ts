/**
 * Minimal middleware — auth is handled in each page/API route.
 * This file exists to avoid Next.js warnings; it does nothing.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],   // empty = middleware never runs
}
