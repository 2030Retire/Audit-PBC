import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  return createMiddlewareClient({ req, res });
} 