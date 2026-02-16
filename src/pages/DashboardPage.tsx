import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { ApiError, apiFetch } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

usePageTitle("Dashboard");

export default function DashboardPage() {
  const { user, loading, error } = useAuth();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isBranchManager = user?.role === "BRANCH_MANAGER";
  const isRegularUser = !!user && !isSuperAdmin && !isBranchManager;
  const branchLabel = user?.branch_id
    ? `Branch ${user.branch_id}`
    : "My branch";

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [categories, setCategories] = useState<
    Array<{ key: string; label: string; count: number }>
  >([]);
  const [recent, setRecent] = useState<
    Array<{
      file_name: string;
      file_type?: string | null;
      file_size: number;
      file_path: string;
      created_at: string;
    }>
  >([]);

  const RECENT_PAGE_SIZE = 5;
  const [recentPage, setRecentPage] = useState(1);

  useEffect(() => {
    setRecentPage(1);
  }, [recent]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!isRegularUser || !user?.branch_id) return;
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const res = await apiFetch<{
          categories: Array<{ key: string; label: string; count: number }>;
          recent: Array<{
            file_name: string;
            file_type?: string | null;
            file_size: number;
            file_path: string;
            created_at: string;
          }>;
        }>(
          `/files/dashboard-summary?branch_id=${encodeURIComponent(String(user.branch_id))}`,
          { method: "GET" },
          { auth: true },
        );
        if (!cancelled) {
          setCategories(res.categories);
          setRecent(res.recent);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setSummaryError(
              `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
            );
          } else {
            setSummaryError("Failed to load dashboard");
          }
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [isRegularUser, user?.branch_id]);

  const catByKey = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; count: number }
    >();
    for (const c of categories) map.set(c.key, c);
    return map;
  }, [categories]);

  const recentTotalPages = Math.max(
    1,
    Math.ceil(recent.length / RECENT_PAGE_SIZE),
  );
  const safeRecentPage = Math.min(Math.max(1, recentPage), recentTotalPages);
  const recentSlice = recent.slice(
    (safeRecentPage - 1) * RECENT_PAGE_SIZE,
    safeRecentPage * RECENT_PAGE_SIZE,
  );

  function fmtSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    const fixed = i === 0 ? 0 : v >= 10 ? 1 : 2;
    return `${v.toFixed(fixed)} ${units[i]}`;
  }

  function fmtDate(x: string): string {
    const d = new Date(x);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  function fileKind(ft?: string | null): { key: string; label: string } {
    const x = (ft ?? "").toLowerCase();
    if (x.startsWith("image/")) return { key: "images", label: "Images" };
    if (x.startsWith("video/")) return { key: "videos", label: "Videos" };
    if (x.startsWith("audio/")) return { key: "audio", label: "Audio" };
    return { key: "documents", label: "Documents" };
  }

  const stats = isBranchManager
    ? [
        {
          label: "My Branch Files",
          value: "—",
          sub: `Files in ${branchLabel}`,
        },
        {
          label: "My Branch Storage",
          value: "—",
          sub: `Storage used in ${branchLabel}`,
        },
        {
          label: "Shared With Me",
          value: "—",
          sub: "Files shared to your account",
        },
        {
          label: "Recent Activity",
          value: "—",
          sub: "Actions in last 24 hours",
        },
      ]
    : [
        { label: "Total Files", value: "12", sub: "Across all branches" },
        {
          label: "Storage Used",
          value: "178.7 MB",
          sub: "Total storage consumption",
        },
        { label: "Branches", value: "4", sub: "Active locations" },
        {
          label: "Recent Activity",
          value: "8",
          sub: "Actions in last 24 hours",
        },
      ];

  const fileTypes = [
    { label: "Documents", pct: 68 },
    { label: "Images", pct: 24 },
    { label: "Videos", pct: 8 },
  ];

  const recentFiles = [
    { name: "Branch Report.pdf", sub: "branch_1", size: "1.2 MB" },
    { name: "Invoice Scan.jpg", sub: "branch_1", size: "340 KB" },
    { name: "Welcome Presentation.pptx", sub: "branch_2", size: "2.8 MB" },
    { name: "Inventory List.xlsx", sub: "branch_3", size: "820 KB" },
  ];

  const branchStorage = [
    { name: "New York Headquarters", used: "23.8 MB", pct: 42 },
    { name: "Los Angeles Branch", used: "13.0 MB", pct: 28 },
    { name: "Chicago Branch", used: "12.6 MB", pct: 24 },
    { name: "Miami Branch", used: "8.4 MB", pct: 18 },
  ];

  const activity = [
    { who: "System Administrator", what: "logged in", when: "2 minutes ago" },
    {
      who: "David Wilson",
      what: "uploaded Welcome Presentation.pptx",
      when: "11 minutes ago",
    },
    { who: "Mia Chen", what: "created Projects folder", when: "2 hours ago" },
    {
      who: "Erica Doe",
      what: "uploaded Marketing Campaign.pdf",
      when: "1 day ago",
    },
  ];

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {isRegularUser ? (
        <div className="space-y-4">
          {summaryError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {summaryError}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Category
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  {
                    key: "images",
                    label: "Images",
                    box: "bg-rose-50 border-rose-200",
                    chip: "bg-rose-100 text-rose-700",
                  },
                  {
                    key: "documents",
                    label: "Documents",
                    box: "bg-sky-50 border-sky-200",
                    chip: "bg-sky-100 text-sky-700",
                  },
                  {
                    key: "audio",
                    label: "Audio",
                    box: "bg-amber-50 border-amber-200",
                    chip: "bg-amber-100 text-amber-700",
                  },
                  {
                    key: "videos",
                    label: "Videos",
                    box: "bg-emerald-50 border-emerald-200",
                    chip: "bg-emerald-100 text-emerald-700",
                  },
                ] as const
              ).map((c) => {
                const count = catByKey.get(c.key)?.count ?? 0;
                return (
                  <a
                    key={c.key}
                    href="/file-manager"
                    className={`rounded-2xl border p-4 transition-colors hover:bg-white dark:hover:bg-slate-950 ${c.box}`}>
                    <div className="text-sm font-semibold text-slate-900">
                      {c.label}
                    </div>
                    <div
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${c.chip}`}>
                      {summaryLoading ? "—" : `${count} files`}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Recent
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Recently uploaded files you can access
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!summaryLoading && recent.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                      disabled={safeRecentPage <= 1}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                      Prev
                    </button>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Page {safeRecentPage} of {recentTotalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setRecentPage((p) => Math.min(recentTotalPages, p + 1))
                      }
                      disabled={safeRecentPage >= recentTotalPages}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                      Next
                    </button>
                  </div>
                ) : null}

                <a
                  href="/file-manager"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                  View all
                </a>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {summaryLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Loading…
                </div>
              ) : recent.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  No recent files.
                </div>
              ) : (
                recentSlice.map((r) => {
                  const kind = fileKind(r.file_type);
                  const pill =
                    kind.key === "images"
                      ? "bg-rose-50 border-rose-200"
                      : kind.key === "videos"
                        ? "bg-emerald-50 border-emerald-200"
                        : kind.key === "audio"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-sky-50 border-sky-200";
                  return (
                    <div
                      key={r.file_path}
                      className={`grid grid-cols-[1fr_1.2fr_0.8fr_auto] items-center gap-3 rounded-2xl border px-4 py-3 ${pill}`}>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {r.file_name}
                        </div>
                      </div>
                      <div className="truncate text-xs font-medium text-slate-700">
                        {(r.file_type ?? "File").toUpperCase()}
                      </div>
                      <div className="text-xs font-medium text-slate-700">
                        {fmtDate(r.created_at)}
                      </div>
                      <div className="shrink-0 text-xs font-semibold text-slate-700">
                        {fmtSize(r.file_size)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {s.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {loading ? "—" : s.value}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isRegularUser && (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-1 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                File Types
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Distribution by category
              </div>
              <div className="mt-4 space-y-4">
                {fileTypes.map((t) => (
                  <div key={t.label}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium text-slate-700 dark:text-slate-200">
                        {t.label}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {t.pct}%
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-900">
                      <div
                        className="h-2 rounded-full bg-slate-900 dark:bg-slate-200"
                        style={{ width: `${t.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Recent Files
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Recently uploaded or modified files
                  </div>
                </div>
                <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                  View all
                </button>
              </div>
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {recentFiles.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {f.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {f.sub}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {f.size}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {isBranchManager ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  My Branch
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Quick actions for {branchLabel}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <a
                    href="/file-manager"
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/60">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Manage Files
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Browse folders and upload documents
                    </div>
                  </a>
                  <a
                    href="/shared-files"
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/60">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Shared Files
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Open files shared with you
                    </div>
                  </a>
                  <a
                    href="/users"
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/60">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Users
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Add and manage your branch users
                    </div>
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Branch Storage
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Storage usage by branch
                </div>
                <div className="mt-4 space-y-4">
                  {branchStorage.map((b) => (
                    <div key={b.name}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                          {b.name}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {b.used}
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-900">
                        <div
                          className="h-2 rounded-full bg-slate-900 dark:bg-slate-200"
                          style={{ width: `${b.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-1 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Activity Log
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Recent system activity
              </div>
              <div className="mt-4 max-h-72 space-y-3 overflow-auto pr-1">
                {activity.map((a, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {a.who}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      {a.what}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {a.when}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
