/**
 * Server-side Supabase clients
 * - getSupabaseClient(): anon key, for authenticated user operations
 * - getServiceClient(): service role key, for platform-level admin operations
 */

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Anon client — uses session cookies, respects RLS
 */
export async function getSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ignore in read-only contexts
          }
        },
      },
    }
  )
}

/**
 * Service role client — bypasses RLS, for server-side admin operations only
 * NEVER expose this to the browser
 */
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Scoped query builder — always includes firm_id in WHERE clause
 */
export class ScopedQuery {
  private client: ReturnType<typeof createClient>

  constructor(client: ReturnType<typeof createClient>) {
    this.client = client
  }

  async selectOne<T>(
    table: string,
    firmId: string,
    filters: Record<string, any> = {}
  ): Promise<T | null> {
    let query = this.client
      .from(table)
      .select('*')
      .eq('firm_id', firmId)

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value) as any
      }
    }

    const { data, error } = await (query as any).limit(1).maybeSingle()

    if (error) throw error
    return data as T
  }

  async select<T>(
    table: string,
    firmId: string,
    filters: Record<string, any> = {},
    limit?: number
  ): Promise<T[]> {
    let query = this.client
      .from(table)
      .select('*')
      .eq('firm_id', firmId)

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value) as any
      }
    }

    if (limit) query = query.limit(limit) as any

    const { data, error } = await query
    if (error) throw error
    return (data || []) as T[]
  }

  async insert<T>(table: string, firmId: string, payload: any): Promise<T> {
    const { data, error } = await this.client
      .from(table)
      .insert({ ...payload, firm_id: firmId })
      .select()
      .single()

    if (error) throw error
    return data as T
  }

  async update<T>(
    table: string,
    firmId: string,
    id: string,
    payload: any,
    idField: string = 'id'
  ): Promise<T> {
    const { data, error } = await this.client
      .from(table)
      .update(payload)
      .eq('firm_id', firmId)
      .eq(idField, id)
      .select()
      .single()

    if (error) throw error
    return data as T
  }

  async softDelete(
    table: string,
    firmId: string,
    id: string,
    idField: string = 'id'
  ): Promise<void> {
    const { error } = await this.client
      .from(table)
      .update({ status: 'DELETED', updated_at: new Date().toISOString() })
      .eq('firm_id', firmId)
      .eq(idField, id)

    if (error) throw error
  }

  getRawClient() {
    return this.client
  }
}
