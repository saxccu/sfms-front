import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FolderOpen,
  Share2,
  Video,
  Users,
  Building2,
  Settings,
  Search,
  Sun,
  Moon,
  Menu,
  ChevronLeft,
  ChevronRight,
  Bell,
} from 'lucide-react'

import ActionDropdown, { type ActionDropdownItem } from './ActionDropdown'
import { useAuth } from '../context/AuthContext'
import { clearAccessToken } from '../lib/storage'
import { getEffectiveTheme, setTheme, type ThemeMode } from '../lib/theme'

type NavItem = {
  to: string
  label: string
  icon: any
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/file-manager', label: 'File Manager', icon: FolderOpen },
  { to: '/shared-files', label: 'Shared files', icon: Share2 },
  { to: '/meet', label: 'Meeting', icon: Video, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
  { to: '/users', label: 'Users', icon: Users, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
  { to: '/branches', label: 'Branches', icon: Building2, roles: ['SUPER_ADMIN'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['SUPER_ADMIN'] },
]

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [theme, setThemeState] = useState<ThemeMode>(() => getEffectiveTheme())
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  function logout() {
    clearAccessToken()
    navigate('/login', { replace: true })
  }

  const role = user?.role ?? null

  const profileItems: ActionDropdownItem[] = [
    {
      label: 'My Profile',
      onClick: () => navigate('/settings'),
    },
    { type: 'separator' },
    {
      label: 'Log out',
      danger: true,
      onClick: logout,
    },
  ]

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    setThemeState(newTheme)
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'U'

  const currentPageLabel = NAV_ITEMS.find((i) => i.to === location.pathname)?.label ?? 'SFMS'

  return (
    <div className={`flex h-screen w-full overflow-hidden bg-lemon-cream text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 font-sans`}>
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{
          width: isSidebarOpen ? '280px' : '88px',
          x: isMobileMenuOpen ? 0 : (window.innerWidth < 1024 ? -280 : 0)
        }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200/50 dark:bg-slate-900 dark:border-slate-800 lg:static lg:translate-x-0 transition-all duration-300 ease-in-out`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-primary text-white shadow-lg shadow-emerald-primary/20">
              <FolderOpen size={22} />
            </div>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xl font-black tracking-tight text-slate-900 dark:text-white"
              >
                FileCloud <span className="text-emerald-primary text-xs font-medium">PRO</span>
              </motion.div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-full hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-4 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const allowed = !item.roles || (role ? item.roles.includes(role) : false)
            if (!allowed) return null

            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-200 group ${
                    isActive
                      ? 'bg-emerald-primary text-white shadow-lg shadow-emerald-100 dark:shadow-none font-semibold'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300'
                  }`
                }
                end
              >
                <Icon size={22} className="shrink-0" />
                {isSidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-4 hidden rounded-lg bg-slate-900 px-2 py-1 text-xs text-white group-hover:block whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
           {isSidebarOpen ? (
             <div className="rounded-3xl bg-emerald-50/50 p-5 dark:bg-emerald-950/20">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Storage</div>
                <div className="mt-3 h-2 w-full rounded-full bg-emerald-200/30 dark:bg-emerald-900/30 overflow-hidden">
                   <div className="h-full w-[65%] rounded-full bg-emerald-primary shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex justify-between">
                  <span>12.4 GB of 20 GB</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-500">65%</span>
                </div>
             </div>
           ) : (
             <div className="flex justify-center">
                <div className="h-10 w-1 rounded-full bg-emerald-primary" />
             </div>
           )}
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 h-20 flex items-center justify-between px-6 glass-effect border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex relative max-w-md w-full ml-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search files, folders..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-primary/20 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 transition-all shadow-sm"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 transition-all shadow-sm">
              <Bell size={20} />
            </button>

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

            <ActionDropdown
              items={profileItems}
              buttonLabel={
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white dark:bg-emerald-primary shadow-md">
                    {initials || 'U'}
                  </div>
                  <div className="hidden text-left xl:block">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      {user?.name ?? 'User'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-tighter font-semibold">
                      {role?.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              }
              buttonClassName="!bg-transparent !border-none !shadow-none !p-0 !text-inherit"
              menuClassName="!w-[220px] !rounded-2xl !mt-2 !shadow-2xl !border-slate-100 dark:!border-slate-800"
            />
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
                  {currentPageLabel}
                </h1>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                   {user ? `Hello ${user.name}, welcome back!` : 'Manage your cloud workspace'}
                </p>
              </div>

              {location.pathname === '/file-manager' && (
                <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-primary text-white rounded-2xl font-semibold shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition-all">
                   <FolderOpen size={18} />
                   <span>Explorer View</span>
                </button>
              )}
            </div>

            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
