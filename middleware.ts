/**
 * Minimal pass-through middleware.
 * Auth is handled in each page/API route handler.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(_req: NextRequest) {
  return NextResponse.next()
}
