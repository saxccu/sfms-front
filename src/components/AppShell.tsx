import { useEffect, useMemo, useState } from "react";
import type { ComponentType, SVGProps } from "react";

import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  Cog6ToothIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  MapPinIcon,
  Squares2X2Icon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import ActionDropdown, { type ActionDropdownItem } from "./ActionDropdown";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { clearAccessToken } from "../lib/storage";
import { getEffectiveTheme, setTheme, type ThemeMode } from "../lib/theme";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  to: string;
  label: string;
  icon: NavIcon;
  roles?: string[];
  /** Only match this path exactly (e.g. dashboard at `/`) */
  end?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: ChartBarSquareIcon, end: true },
  { to: "/file-manager", label: "File Manager", icon: FolderIcon },
  { to: "/shared-files", label: "Shared files", icon: DocumentDuplicateIcon },
  {
    to: "/meet",
    label: "Meeting",
    icon: CalendarDaysIcon,
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
  },
  {
    to: "/users",
    label: "Users",
    icon: UsersIcon,
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
  },
  {
    to: "/branches",
    label: "Branches",
    icon: MapPinIcon,
    roles: ["SUPER_ADMIN"],
  },
  { to: "/settings", label: "Settings", icon: Cog6ToothIcon, roles: ["SUPER_ADMIN"] },
];

function headerTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/": "Dashboard",
    "/file-manager": "File Manager",
    "/shared-files": "Shared files",
    "/meet": "Meeting",
    "/users": "Users",
    "/branches": "Branches",
    "/settings": "Settings",
    "/upload": "Upload",
    "/operations": "Operations",
    "/editor": "Document editor",
  };
  return map[pathname] ?? "SFMS";
}

export default function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [branchName, setBranchName] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>(() => getEffectiveTheme());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const pageTitle = useMemo(() => headerTitle(pathname), [pathname]);

  function logout() {
    clearAccessToken();
    navigate("/login", { replace: true });
  }

  const role = user?.role ?? null;

  const initials = (user?.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const profileItems: ActionDropdownItem[] = [
    {
      label: "Logout",
      danger: true,
      onClick: logout,
    },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadBranchName() {
      if (!user?.branch_id) {
        setBranchName(null);
        return;
      }
      try {
        const branches = await apiFetch<Array<{ id: number; name: string }>>(
          "/branches",
          { method: "GET" },
          { auth: true },
        );
        const match = branches.find((b) => b.id === user.branch_id);
        if (!cancelled) {
          setBranchName(match?.name ?? null);
        }
      } catch {
        if (!cancelled) {
          setBranchName(null);
        }
      }
    }

    loadBranchName();
    return () => {
      cancelled = true;
    };
  }, [user?.branch_id]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) {
        setMobileNavOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <div className="flex h-full min-h-screen bg-slate-100/90 dark:bg-brand-950">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/45 md:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-slate-200/90 bg-white shadow-[4px_0_32px_-12px_rgba(15,23,42,0.14)] transition-transform duration-200 ease-out md:relative md:z-20 md:w-64 md:max-w-none md:translate-x-0",
          "dark:border-brand-800 dark:bg-[linear-gradient(180deg,#0f1419_0%,#0b0f14_100%)] dark:shadow-[4px_0_40px_-16px_rgba(0,0,0,0.55)]",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 dark:border-brand-800/80">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-900/20 ring-1 ring-white/20 dark:from-brand-500 dark:to-brand-800 dark:shadow-black/40">
            <Squares2X2Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              SAXCCU FMS
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/50">
              Enterprise
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 pb-8">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-white/35">
            Menu
          </p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const allowed =
                !item.roles || (role ? item.roles.includes(role) : false);

              if (!allowed) {
                return null;
              }

              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      isActive
                        ? "border border-brand-200/90 bg-brand-50 text-brand-900 shadow-sm shadow-brand-900/[0.06] dark:border-brand-500/30 dark:bg-brand-600/15 dark:text-white dark:shadow-none"
                        : "border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white",
                    ].join(" ")
                  }>
                  {({ isActive }) => (
                    <>
                      <span
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isActive
                            ? "bg-white text-brand-700 shadow-sm dark:bg-brand-500/20 dark:text-brand-200"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 dark:bg-white/[0.06] dark:text-white/50 dark:group-hover:bg-white/10 dark:group-hover:text-white/80",
                        ].join(" ")}>
                        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200/90 bg-white/85 px-3 py-3 backdrop-blur-md sm:px-4 md:px-6 md:py-4 dark:border-brand-700 dark:bg-brand-900/80">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 md:hidden dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                {mobileNavOpen ? (
                  <XMarkIcon className="h-5 w-5" aria-hidden />
                ) : (
                  <Bars3Icon className="h-5 w-5" aria-hidden />
                )}
              </button>
              <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {pageTitle}
              </div>
              <div className="mt-0.5 hidden text-sm text-slate-600 dark:text-white/75 sm:block">
                {user ? `Welcome back, ${user.name}.` : "Loading user…"}
              </div>
            </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                aria-label={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }>
                {theme === "dark" ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5">
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
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
                  </svg>
                )}
              </button>

              <ActionDropdown
                items={profileItems}
                buttonLabel={
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-sm font-semibold text-white ring-2 ring-white dark:from-white dark:to-slate-200 dark:text-slate-900 dark:ring-brand-700">
                      {initials || "U"}
                    </div>
                    <div className="hidden text-left md:block">
                      <div className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
                        {user?.name ?? "User"}
                      </div>
                      <div className="text-xs leading-tight text-slate-500 dark:text-slate-400">
                        {user
                          ? `${user.role} · ${branchName ?? `Branch ${user.branch_id}`}`
                          : ""}
                      </div>
                    </div>
                  </div>
                }
                buttonClassName="!rounded-full !border !border-slate-200 !bg-white !px-2.5 !py-1.5 !text-slate-700 !shadow-sm hover:!border-slate-300 hover:!bg-slate-50 dark:!border-brand-700 dark:!bg-brand-950 dark:!text-slate-200 dark:hover:!bg-brand-900"
                menuClassName="!w-[220px]"
              />
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 [background-image:radial-gradient(at_0%_0%,rgba(13,148,136,0.07),transparent_50%),linear-gradient(to_right,rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] [background-size:auto,28px_28px,28px_28px] dark:[background-image:radial-gradient(at_0%_0%,rgba(20,184,166,0.08),transparent_45%),linear-gradient(to_right,rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.04)_1px,transparent_1px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
