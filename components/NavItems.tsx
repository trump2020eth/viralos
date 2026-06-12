'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    label: 'WORKSPACE',
    items: [
      {
        href: '/dashboard',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
        ),
        label: 'Dashboard',
      },
      {
        href: '/new-project',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        ),
        label: 'New Video',
      },
      {
        href: '/library',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M19 11H5M19 11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2M19 11V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>
          </svg>
        ),
        label: 'Library',
      },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      {
        href: '/integrations',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" opacity=".2" fill="currentColor" stroke="none"/>
            <path d="M12 8v4l3 3"/>
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        ),
        label: 'Integrations',
      },
    ],
  },
  {
    label: 'COMING SOON',
    items: [
      {
        href: '#',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2a10 10 0 1 0 10 10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        ),
        label: 'Render Queue',
        badge: 'Step 5',
        disabled: true,
      },
      {
        href: '#',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            <path d="m13 13 6 6"/>
          </svg>
        ),
        label: 'Publish',
        badge: 'Phase 2',
        disabled: true,
      },
    ],
  },
]

export default function NavItems() {
  const pathname = usePathname()

  return (
    <>
      {NAV_ITEMS.map(group => (
        <div key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map(item => {
            const isActive = pathname === item.href
            const isDisabled = (item as any).disabled

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={isDisabled ? { opacity: 0.4, pointerEvents: 'none' } : {}}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
                {(item as any).badge && (
                  <span className="nav-badge">{(item as any).badge}</span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </>
  )
}
