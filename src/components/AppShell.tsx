import { useEffect, useState } from 'react'

import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import ActionDropdown, { type ActionDropdownItem } from './ActionDropdown'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { clearAccessToken } from '../lib/storage'
import { getEffectiveTheme, setTheme, type ThemeMode } from '../lib/theme'

type NavItem = {
  to: string
  label: string
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/file-manager', label: 'File Manager' },
  { to: '/shared-files', label: 'Shared files' },
  { to: '/meet', label: 'Meeting', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
  { to: '/users', label: 'Users', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
  { to: '/branches', label: 'Branches', roles: ['SUPER_ADMIN'] },
  { to: '/settings', label: 'Settings', roles: ['SUPER_ADMIN'] },
]

export default function AppShell() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [branchName, setBranchName] = useState<string | null>(null)
  const [theme, setThemeState] = useState<ThemeMode>(() => getEffectiveTheme())

  function logout() {
    clearAccessToken()
    navigate('/login', { replace: true })
  }

  const role = user?.role ?? null

  const initials = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  const profileItems: ActionDropdownItem[] = [
    {
      label: 'Logout',
      danger: true,
      onClick: logout,
    },
  ]

  useEffect(() => {
    let cancelled = false

    async function loadBranchName() {
      if (!user?.branch_id) {
        setBranchName(null)
        return
      }
      try {
        const branches = await apiFetch<Array<{ id: number; name: string }>>('/branches', { method: 'GET' }, { auth: true })
        const match = branches.find((b) => b.id === user.branch_id)
        if (!cancelled) {
          setBranchName(match?.name ?? null)
        }
      } catch {
        if (!cancelled) {
          setBranchName(null)
        }
      }
    }

    loadBranchName()
    return () => {
      cancelled = true
    }
  }, [user?.branch_id])

  function toggleTheme() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <div className="flex h-full min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="w-64 border-r border-white/15 bg-[#001777]">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
            F
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">File Manager</div>
            <div className="text-xs text-white/70">Enterprise</div>
          </div>
        </div>

        <nav className="px-3 py-2">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const allowed = !item.roles || (role ? item.roles.includes(role) : false)

              if (!allowed) {
                return null
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive
                      ? 'flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-white'
                      : 'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10'
                  }
                  end
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-60" />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-white/15 bg-[#fe0000] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">Dashboard</div>
              <div className="text-sm text-white/80">
                {user ? `Welcome back, ${user.name}.` : 'Loading user…'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M12 3v2" />
                    <path d="M12 19v2" />
                    <path d="M4.22 4.22l1.42 1.42" />
                    <path d="M18.36 18.36l1.42 1.42" />
                    <path d="M3 12h2" />
                    <path d="M19 12h2" />
                    <path d="M4.22 19.78l1.42-1.42" />
                    <path d="M18.36 5.64l1.42-1.42" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
                  </svg>
                )}
              </button>

              <ActionDropdown
                items={profileItems}
                buttonLabel={
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                      {initials || 'U'}
                    </div>
                    <div className="hidden text-left md:block">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{user?.name ?? 'User'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{user ? `${user.role} · ${branchName ?? `Branch ${user.branch_id}`}` : ''}</div>
                    </div>
                  </div>
                }
                buttonClassName="!bg-white !text-slate-700 !shadow-none !px-2 !py-1.5 !rounded-full border border-slate-200 hover:!bg-slate-100 dark:!bg-slate-950 dark:!text-slate-200 dark:!border-slate-800 dark:hover:!bg-slate-900"
                menuClassName="!w-[220px]"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
