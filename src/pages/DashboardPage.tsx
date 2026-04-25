import { useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { ApiError, apiFetch } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

type DashboardCategory = { key: string; label: string; count: number };

type DashboardRecent = {
  file_name: string;
  file_type?: string | null;
  file_size: number;
  file_path: string;
  created_at: string;
  uploaded_by_name?: string | null;
};

type DashboardSummaryResponse = {
  categories: DashboardCategory[];
  recent: DashboardRecent[];
  total_files?: number;
  total_storage_bytes?: number;
  total_storage_capacity_bytes?: number;
  branch_storage_capacity_bytes?: number;
  uploads_last_24h?: number;
};

type AdminRecent = DashboardRecent & { branch_name: string };

type AdminDashboardResponse = {
  total_files: number;
  total_storage_bytes: number;
  total_storage_capacity_bytes: number;
  branch_storage_capacity_bytes: number;
  branch_count: number;
  uploads_last_24h: number;
  categories: DashboardCategory[];
  recent: AdminRecent[];
  branch_storage: Array<{
    branch_id: number;
    branch_name: string;
    bytes_used: number;
    capacity_bytes: number;
  }>;
  activity: Array<{
    user_name: string;
    description: string;
    created_at: string;
  }>;
};

type CapacityState = {
  pct: number;
  colorClass: string;
  label: string;
  hint: string;
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diffSec / 86400), "day");
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getCapacityState(pct: number): CapacityState {
  if (pct >= 95) {
    return {
      pct,
      colorClass: "bg-rose-600 dark:bg-rose-500",
      label: "Near Full / Full",
      hint: "Storage full - delete or upgrade",
    };
  }
  if (pct >= 85) {
    return {
      pct,
      colorClass: "bg-orange-500 dark:bg-orange-400",
      label: "Critical",
      hint: "Almost full",
    };
  }
  if (pct >= 70) {
    return {
      pct,
      colorClass: "bg-amber-500 dark:bg-amber-400",
      label: "Warning Zone",
      hint: "Storage filling up",
    };
  }
  return {
    pct,
    colorClass: "bg-brand-600 dark:bg-brand-400",
    label: "Healthy",
    hint: "Normal usage",
  };
}

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const { user, loading, error } = useAuth();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isBranchManager = user?.role === "BRANCH_MANAGER";
  const isRegularUser = !!user && !isSuperAdmin && !isBranchManager;
  const branchLabel = user?.branch_id
    ? `Branch ${user.branch_id}`
    : "My branch";

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [categories, setCategories] = useState<DashboardCategory[]>([]);
  const [recent, setRecent] = useState<DashboardRecent[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);
  const [branchStorageCapacityBytes, setBranchStorageCapacityBytes] =
    useState(0);
  const [uploadsLast24h, setUploadsLast24h] = useState(0);

  const [sharedWithMeCount, setSharedWithMeCount] = useState<number | null>(
    null,
  );

  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboardResponse | null>(
    null,
  );

  const RECENT_PAGE_SIZE = 5;
  const [recentPage, setRecentPage] = useState(1);

  useEffect(() => {
    setRecentPage(1);
  }, [recent]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!user?.branch_id) return;
      if (!isRegularUser && !isBranchManager) return;

      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const res = await apiFetch<DashboardSummaryResponse>(
          `/files/dashboard-summary?branch_id=${encodeURIComponent(String(user.branch_id))}`,
          { method: "GET" },
          { auth: true },
        );
        if (!cancelled) {
          setCategories(res.categories);
          setRecent(res.recent);
          setTotalFiles(res.total_files ?? 0);
          setTotalStorageBytes(res.total_storage_bytes ?? 0);
          setBranchStorageCapacityBytes(res.branch_storage_capacity_bytes ?? 0);
          setUploadsLast24h(res.uploads_last_24h ?? 0);
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
  }, [isRegularUser, isBranchManager, user?.branch_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedCount() {
      if (!isBranchManager || !user?.branch_id) {
        setSharedWithMeCount(null);
        return;
      }
      try {
        const rows = await apiFetch<unknown[]>(
          "/files/shared-with-me",
          { method: "GET" },
          { auth: true },
        );
        if (!cancelled) setSharedWithMeCount(Array.isArray(rows) ? rows.length : 0);
      } catch {
        if (!cancelled) setSharedWithMeCount(null);
      }
    }

    loadSharedCount();
    return () => {
      cancelled = true;
    };
  }, [isBranchManager, user?.branch_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdmin() {
      if (!isSuperAdmin) {
        setAdminData(null);
        setAdminError(null);
        return;
      }
      setAdminLoading(true);
      setAdminError(null);
      try {
        const res = await apiFetch<AdminDashboardResponse>(
          "/files/dashboard-admin",
          { method: "GET" },
          { auth: true },
        );
        if (!cancelled) setAdminData(res);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setAdminError(
              `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
            );
          } else {
            setAdminError("Failed to load admin dashboard");
          }
          setAdminData(null);
        }
      } finally {
        if (!cancelled) setAdminLoading(false);
      }
    }

    loadAdmin();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const catByKey = useMemo(() => {
    const map = new Map<string, DashboardCategory>();
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

  const fileTypesFromCategories = useMemo(() => {
    const src = adminData?.categories ?? [];
    const total = src.reduce((s, c) => s + c.count, 0);
    if (total <= 0) {
      return src.map((c) => ({ label: c.label, pct: 0 }));
    }
    return src.map((c) => ({
      label: c.label,
      pct: Math.round((c.count / total) * 100),
    }));
  }, [adminData?.categories]);

  const globalCapacityState = useMemo(() => {
    const used = adminData?.total_storage_bytes ?? 0;
    const cap = Math.max(adminData?.total_storage_capacity_bytes ?? 0, 1);
    const pct = Math.max(
      0,
      Math.min(100, Math.round((used / cap) * 100)),
    );
    return getCapacityState(pct);
  }, [adminData?.total_storage_bytes, adminData?.total_storage_capacity_bytes]);

  const branchStorageBars = useMemo(() => {
    if (!adminData?.branch_storage?.length) return [];
    return adminData.branch_storage.map((b) => ({
      name: b.branch_name,
      used: fmtSize(b.bytes_used),
      capacity: fmtSize(b.capacity_bytes),
      pct: Math.max(
        0,
        Math.min(100, Math.round((b.bytes_used / Math.max(b.capacity_bytes, 1)) * 100)),
      ),
      state: getCapacityState(
        Math.max(
          0,
          Math.min(100, Math.round((b.bytes_used / Math.max(b.capacity_bytes, 1)) * 100)),
        ),
      ),
    }));
  }, [adminData?.branch_storage]);

  const branchManagerStats = useMemo(
    () => [
      {
        label: "My Branch Files",
        value: summaryLoading ? "—" : String(totalFiles),
        sub: `Files in ${branchLabel}`,
      },
      {
        label: "My Branch Storage",
        value:
          summaryLoading || branchStorageCapacityBytes <= 0
            ? "—"
            : `${fmtSize(totalStorageBytes)} / ${fmtSize(branchStorageCapacityBytes)}`,
        sub:
          branchStorageCapacityBytes > 0
            ? `${Math.min(100, Math.round((totalStorageBytes / Math.max(branchStorageCapacityBytes, 1)) * 100))}% used in ${branchLabel}`
            : `Storage used in ${branchLabel}`,
      },
      {
        label: "Shared With Me",
        value: sharedWithMeCount === null ? "—" : String(sharedWithMeCount),
        sub: "Files shared to your account",
      },
      {
        label: "Recent Activity",
        value: summaryLoading ? "—" : String(uploadsLast24h),
        sub: "Uploads in the last 24 hours",
      },
    ],
    [
      branchLabel,
      sharedWithMeCount,
      summaryLoading,
      totalFiles,
      totalStorageBytes,
      branchStorageCapacityBytes,
      uploadsLast24h,
    ],
  );

  const superAdminStats = useMemo(
    () => [
      {
        label: "Total Files",
        value: adminLoading || !adminData ? "—" : String(adminData.total_files),
        sub: "Across all branches",
      },
      {
        label: "Storage Used",
        value:
          adminLoading || !adminData
            ? "—"
            : fmtSize(adminData.total_storage_bytes),
        sub: "Total storage consumption",
      },
      {
        label: "Branches",
        value:
          adminLoading || !adminData
            ? "—"
            : String(adminData.branch_count),
        sub: "Registered locations",
      },
      {
        label: "Recent Activity",
        value:
          adminLoading || !adminData
            ? "—"
            : String(adminData.uploads_last_24h),
        sub: "Uploads in the last 24 hours",
      },
    ],
    [adminData, adminLoading],
  );

  const branchActivityFromRecent = useMemo(
    () =>
      recent.map((r) => ({
        who: r.uploaded_by_name?.trim() || "User",
        what: `uploaded ${r.file_name}`,
        when: formatRelativeTime(r.created_at),
      })),
    [recent],
  );

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

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-brand-800 dark:bg-brand-950">
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
                  <Link
                    key={c.key}
                    to="/file-manager"
                    className={`rounded-2xl border p-4 transition-colors hover:bg-white dark:hover:bg-slate-950 ${c.box}`}>
                    <div className="text-sm font-semibold text-slate-900">
                      {c.label}
                    </div>
                    <div
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${c.chip}`}>
                      {summaryLoading ? "—" : `${count} files`}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-brand-800 dark:bg-brand-950">
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
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
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
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
                      Next
                    </button>
                  </div>
                ) : null}

                <Link
                  to="/file-manager"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
                  View all
                </Link>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {summaryLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-brand-800 dark:bg-slate-900 dark:text-slate-300">
                  Loading…
                </div>
              ) : recent.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-brand-800 dark:bg-slate-900 dark:text-slate-300">
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
          {(isBranchManager ? branchManagerStats : superAdminStats).map(
            (s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-brand-800 dark:bg-brand-950">
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
            ),
          )}
        </div>
      )}

      {!isRegularUser && isBranchManager && summaryError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {summaryError}
        </div>
      ) : null}

      {!isRegularUser && isSuperAdmin && adminError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {adminError}
        </div>
      ) : null}

      {!isRegularUser && (
        <>
          {isSuperAdmin ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-1 dark:border-brand-800 dark:bg-brand-950">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  File Types
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Distribution by category
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-brand-800 dark:bg-brand-900/40">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Capacity Status
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {adminLoading || !adminData
                        ? "—"
                        : `${fmtSize(adminData.total_storage_bytes)} / ${fmtSize(adminData.total_storage_capacity_bytes)}`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-brand-900">
                    <div
                      className={`h-2 rounded-full transition-colors ${globalCapacityState.colorClass}`}
                      style={{ width: `${adminLoading || !adminData ? 0 : globalCapacityState.pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {adminLoading || !adminData
                        ? "Loading…"
                        : `${globalCapacityState.label} (${globalCapacityState.pct}%)`}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {adminLoading || !adminData ? "" : globalCapacityState.hint}
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {adminLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : (
                    fileTypesFromCategories.map((t) => (
                      <div key={t.label}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-medium text-slate-700 dark:text-slate-200">
                            {t.label}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {t.pct}%
                          </div>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-brand-900">
                          <div
                            className="h-2 rounded-full bg-brand-600 dark:bg-brand-400"
                            style={{ width: `${t.pct}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2 dark:border-brand-800 dark:bg-brand-950">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Recent Files
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Recently uploaded or modified files
                    </div>
                  </div>
                  <Link
                    to="/file-manager"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
                    View all
                  </Link>
                </div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {adminLoading ? (
                    <div className="py-6 text-center text-sm text-slate-500">
                      Loading…
                    </div>
                  ) : !adminData?.recent.length ? (
                    <div className="py-6 text-center text-sm text-slate-500">
                      No recent files.
                    </div>
                  ) : (
                    adminData.recent.map((f) => (
                      <div
                        key={`${f.file_path}-${f.created_at}`}
                        className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {f.file_name}
                          </div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {f.branch_name}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm text-slate-600 dark:text-slate-300">
                          {fmtSize(f.file_size)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            {isBranchManager ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2 dark:border-brand-800 dark:bg-brand-950">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  My Branch
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Quick actions for {branchLabel}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Link
                    to="/file-manager"
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-brand-800 dark:bg-brand-950 dark:hover:bg-slate-900/60">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Manage Files
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Browse folders and upload documents
                    </div>
                  </Link>
                  <Link
                    to="/shared-files"
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-brand-800 dark:bg-brand-950 dark:hover:bg-slate-900/60">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Shared Files
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Open files shared with you
                    </div>
                  </Link>
                  <Link
                    to="/users"
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-brand-800 dark:bg-brand-950 dark:hover:bg-slate-900/60">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Users
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Add and manage your branch users
                    </div>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2 dark:border-brand-800 dark:bg-brand-950">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Branch Storage
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Storage usage by branch (used vs total capacity)
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Percentages reflect capacity utilization, not distribution across branches.
                </div>
                <div className="mt-4 space-y-4">
                  {adminLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : branchStorageBars.length === 0 ? (
                    <div className="text-sm text-slate-500">
                      No branch data yet.
                    </div>
                  ) : (
                    branchStorageBars.map((b) => (
                      <div key={b.name}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-medium text-slate-700 dark:text-slate-200">
                            {b.name}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {b.used} / {b.capacity} ({b.pct}%)
                          </div>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-brand-900">
                          <div
                            className={`h-2 rounded-full ${b.state.colorClass}`}
                            style={{ width: `${b.pct}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {b.state.label} - {b.state.hint}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  Predictive hint coming soon (e.g., full in ~5 days).
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-1 dark:border-brand-800 dark:bg-brand-950">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Activity Log
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isBranchManager
                  ? "Recent uploads in your branch"
                  : "Recent system activity"}
              </div>
              <div className="mt-4 max-h-72 space-y-3 overflow-auto pr-1">
                {isBranchManager ? (
                  summaryLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : branchActivityFromRecent.length === 0 ? (
                    <div className="text-sm text-slate-500">No activity yet.</div>
                  ) : (
                    branchActivityFromRecent.map((a, idx) => (
                      <div
                        key={`${a.who}-${idx}-${a.when}`}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-brand-800 dark:bg-slate-900">
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
                    ))
                  )
                ) : adminLoading ? (
                  <div className="text-sm text-slate-500">Loading…</div>
                ) : !adminData?.activity.length ? (
                  <div className="text-sm text-slate-500">No activity yet.</div>
                ) : (
                  adminData.activity.map((a, idx) => (
                    <div
                      key={`${a.user_name}-${idx}-${a.created_at}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-brand-800 dark:bg-slate-900">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {a.user_name}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {a.description}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(a.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
