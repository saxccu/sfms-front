import { useEffect, useMemo, useState } from "react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import { ApiError, apiFetch } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

type DashboardCapacityOut = {
  total_capacity_bytes: number;
  branch_capacity_bytes: number;
  source: string;
  rustfs_bucket?: string | null;
};

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

function gbToBytes(gb: number): number {
  return Math.round(gb * 1024 ** 3);
}

function bytesToGb(bytes: number): number {
  return bytes / 1024 ** 3;
}

export default function SettingsPage() {
  usePageTitle("Settings");
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [current, setCurrent] = useState<DashboardCapacityOut | null>(null);

  const [totalGb, setTotalGb] = useState<string>("");
  const [branchGb, setBranchGb] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function loadCapacity() {
      if (!isSuperAdmin) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<DashboardCapacityOut>(
          "/files/dashboard-capacity",
          { method: "GET" },
          { auth: true },
        );
        if (!cancelled) {
          setCurrent(res);
          setTotalGb(bytesToGb(res.total_capacity_bytes).toFixed(2));
          setBranchGb(bytesToGb(res.branch_capacity_bytes).toFixed(2));
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
          } else {
            setError("Failed to load dashboard capacity settings");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCapacity();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const parsed = useMemo(() => {
    const tg = Number(totalGb);
    const bg = Number(branchGb);
    const totalBytes = Number.isFinite(tg) && tg > 0 ? gbToBytes(tg) : 0;
    const branchBytes = Number.isFinite(bg) && bg > 0 ? gbToBytes(bg) : 0;
    const valid = totalBytes > 0 && branchBytes > 0;
    return { valid, totalBytes, branchBytes };
  }, [totalGb, branchGb]);

  async function save() {
    if (!parsed.valid) {
      setError("Provide positive numbers for both capacities.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<DashboardCapacityOut>(
        "/files/dashboard-capacity",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            total_capacity_bytes: parsed.totalBytes,
            branch_capacity_bytes: parsed.branchBytes,
          }),
        },
        { auth: true },
      );
      setCurrent(res);
      setTotalGb(bytesToGb(res.total_capacity_bytes).toFixed(2));
      setBranchGb(bytesToGb(res.branch_capacity_bytes).toFixed(2));
      setNotice("Dashboard capacity updated in RustFS.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Failed to update dashboard capacity");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your account and application preferences.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-300">
          Only super admins can manage storage capacity settings.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure production storage capacities used by dashboard utilization indicators.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-brand-800 dark:bg-brand-950">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <Cog6ToothIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Dashboard Capacity Source
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Source: {current?.source ?? "—"}{current?.rustfs_bucket ? ` · Bucket: ${current.rustfs_bucket}` : ""}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total capacity (GB)
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalGb}
                  onChange={(e) => setTotalGb(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {parsed.totalBytes > 0 ? `${parsed.totalBytes.toLocaleString()} bytes` : "Enter a positive value"}
                </div>
              </label>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Branch capacity (GB)
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={branchGb}
                  onChange={(e) => setBranchGb(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {parsed.branchBytes > 0 ? `${parsed.branchBytes.toLocaleString()} bytes` : "Enter a positive value"}
                </div>
              </label>
            </div>

            {current ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-brand-800 dark:bg-brand-900/40 dark:text-slate-300">
                Current effective values: total {fmtSize(current.total_capacity_bytes)} / per-branch {fmtSize(current.branch_capacity_bytes)}.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {notice}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !parsed.valid}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Capacity Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
