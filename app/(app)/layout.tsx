import { UserButton } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NavItems from '@/components/NavItems'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="shell">
      {/* Top Nav */}
      <header className="topnav">
        <div className="wordmark">ViralOS<span> AI</span></div>
        <div className="nav-right">
          <Link href="/new-project" className="btn btn-accent btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Video
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        <NavItems />
      </aside>

      {/* Page content */}
      <main className="main">
        {children}
      </main>
    </div>
  )
}
