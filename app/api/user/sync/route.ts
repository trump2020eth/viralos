/**
 * POST /api/user/sync
 * Upserts the authenticated Clerk user into the Supabase users table.
 * Called once on dashboard load to ensure the user row exists.
 * Idempotent — safe to call on every session.
 */

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clerkUser = await currentUser()
  if (!clerkUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null
  const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null

  try {
    const db = getSupabaseAdmin()

    const { data, error } = await db
      .from('users')
      .upsert(
        {
          clerk_user_id: userId,
          email,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clerk_user_id' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ user: data })
  } catch (err: any) {
    console.error('[user/sync] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Database error' },
      { status: 500 }
    )
  }
}
