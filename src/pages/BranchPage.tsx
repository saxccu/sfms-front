import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useWait } from "../context/WaitContext";
import { ApiError, apiFetch, apiFetchBlob } from "../lib/api";
import ActionDropdown, {
  type ActionDropdownItem,
} from "../components/ActionDropdown";
import { usePageTitle } from "../hooks/usePageTitle";

type BranchOut = {
  id: number;
  name: string;
  created_at: string;
  location?: string | null;
};

type BranchStorageUsageOut = {
  branch_id: number;
  bytes_used: number;
};

type BranchManagersOut = {
  branch_id: number;
  manager_names: string[];
};

type BranchMeta = {
  code: string;
  location: string;
};

type BranchCard = {
  id: number;
  name: string;
  created_at: string;
  code: string;
  location: string;
  manager: string;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  const precision = u === 0 ? 0 : u >= 3 ? 1 : 1;
  return `${v.toFixed(precision)} ${units[u]}`;
}

export default function BranchPage() {
  usePageTitle("Branch");
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<BranchOut[]>([]);
  const [metaById, setMetaById] = useState<Record<number, BranchMeta>>({});
  const [usageByBranchId, setUsageByBranchId] = useState<
    Record<number, number>
  >({});
  const [managerByBranchId, setManagerByBranchId] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const wait = useWait();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addLocation, setAddLocation] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editBranchId, setEditBranchId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [branchesRes, usageRes] = await Promise.allSettled([
        apiFetch<BranchOut[]>("/branches", { method: "GET" }, { auth: true }),
        apiFetch<BranchStorageUsageOut[]>(
          "/branches/storage-usage",
          { method: "GET" },
          { auth: true },
        ),
      ]);

      const managersRes = await Promise.allSettled([
        apiFetch<BranchManagersOut[]>(
          "/branches/managers",
          { method: "GET" },
          { auth: true },
        ),
      ]);

      if (branchesRes.status === "fulfilled") {
        setRows(branchesRes.value);
      } else {
        const err = branchesRes.reason;
        if (err instanceof ApiError) {
          setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
        } else {
          setError("Failed to load branches");
        }
      }

      if (usageRes.status === "fulfilled") {
        const m: Record<number, number> = {};
        for (const r of usageRes.value) {
          m[r.branch_id] = r.bytes_used;
        }
        setUsageByBranchId(m);
      } else {
        setUsageByBranchId({});
      }

      if (managersRes[0].status === "fulfilled") {
        const m: Record<number, string> = {};
        for (const r of managersRes[0].value) {
          m[r.branch_id] = (r.manager_names ?? []).filter(Boolean).join(", ");
        }
        setManagerByBranchId(m);
      } else {
        setManagerByBranchId({});
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Failed to load branches");
      }
    } finally {
      setLoading(false);
    }
  }

  function sanitizeZipName(name: string): string {
    const safe = name
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/[._-]+$/g, "")
      .replace(/^[._-]+/g, "");
    return safe || "branch";
  }

  async function exportFiles(branchId: number, branchName: string) {
    setError(null);
    setExporting(true);
    wait.start("Exporting branch files…");
    try {
      const blob = await apiFetchBlob(
        `/branches/${encodeURIComponent(String(branchId))}/export`,
        { method: "GET" },
        { auth: true },
      );
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sanitizeZipName(branchName)}_files.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Failed to export files");
      }
    } finally {
      wait.stop();
      setExporting(false);
    }
  }

  function openEditDialog(branch: BranchCard) {
    if (!isSuperAdmin) return;
    setError(null);
    setEditBranchId(branch.id);
    setEditName(branch.name);
    setEditLocation(branch.location || "");
    setEditOpen(true);
  }

  function closeEditDialog() {
    if (editSaving) return;
    setEditOpen(false);
  }

  async function submitEditBranch() {
    if (!isSuperAdmin) return;
    if (!editBranchId) return;

    const name = editName.trim();
    if (!name) {
      setError("Branch name is required");
      return;
    }

    const location = editLocation.trim() || null;

    setEditSaving(true);
    setError(null);
    try {
      await apiFetch<BranchOut>(
        `/branches/${encodeURIComponent(String(editBranchId))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, location }),
        },
        { auth: true },
      );

      setEditOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Failed to update branch");
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteBranch(branchId: number, name: string) {
    const ok = window.confirm(`Delete branch "${name}"?`);
    if (!ok) return;
    await apiFetch(
      `/branches/${encodeURIComponent(String(branchId))}`,
      { method: "DELETE" },
      { auth: true },
    );
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  const branches: BranchCard[] = useMemo(() => {
    const base = rows.map((b) => {
      const meta = metaById[b.id];
      return {
        id: b.id,
        name: b.name,
        created_at: b.created_at,
        code: meta?.code ?? "",
        location: (b.location ?? meta?.location ?? "").toString(),
        manager: managerByBranchId[b.id] ?? "",
      };
    });

    const q2 = q.trim().toLowerCase();
    if (!q2) return base;
    return base.filter((b) => {
      return (
        b.name.toLowerCase().includes(q2) ||
        b.code.toLowerCase().includes(q2) ||
        b.location.toLowerCase().includes(q2) ||
        b.manager.toLowerCase().includes(q2)
      );
    });
  }, [rows, q, metaById, managerByBranchId]);

  function openAddDialog() {
    setAddName("");
    setAddCode("");
    setAddLocation("");
    setAddOpen(true);
  }

  function closeAddDialog() {
    if (creating) return;
    setAddOpen(false);
  }

  async function createBranch() {
    const name = addName.trim();
    if (!name) {
      setError("Branch name is required");
      return;
    }

    const location = addLocation.trim() || null;

    setCreating(true);
    setError(null);
    try {
      const created = await apiFetch<BranchOut>(
        "/branches",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, location }),
        },
        { auth: true },
      );

      setMetaById((prev) => ({
        ...prev,
        [created.id]: {
          code: addCode.trim(),
          location: (created.location ?? addLocation.trim() ?? "").toString(),
        },
      }));

      setAddOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Failed to create branch");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Branch Management
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Manage company branches and locations
          </div>
        </div>

        <button
          onClick={openAddDialog}
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          <span className="text-base leading-none">+</span>
          {creating ? "Adding…" : "Add Branch"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search branches by name, code, or location…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          Loading…
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          No branches yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    ⌂
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {b.name}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                      {b.code || `BR-${b.id}`}
                    </div>
                  </div>
                </div>

                <ActionDropdown
                  items={
                    [
                      {
                        label: "View",
                        onClick: () => {
                          window.location.href = `/file-manager?branch_id=${encodeURIComponent(String(b.id))}`;
                        },
                      },
                      {
                        label: "Export files",
                        onClick: () => exportFiles(b.id, b.name),
                        disabled: exporting,
                      },
                      {
                        label: "Edit",
                        onClick: () => openEditDialog(b),
                        disabled: !isSuperAdmin,
                      },
                      {
                        label: "Delete",
                        danger: true,
                        onClick: () => deleteBranch(b.id, b.name),
                        disabled: !isSuperAdmin,
                      },
                    ] satisfies ActionDropdownItem[] as ActionDropdownItem[]
                  }
                  buttonLabel="⋮"
                  buttonClassName="!rounded-lg !border !border-slate-200 !bg-white !px-2 !py-1 !text-xs !font-medium !text-slate-700 !shadow-none hover:!bg-slate-100 dark:!border-slate-800 dark:!bg-slate-950 dark:!text-slate-200 dark:hover:!bg-slate-900"
                />
              </div>

              <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-3.5 w-3.5">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
                      <path d="M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    </svg>
                  </span>
                  <span className="truncate">{b.location || "—"}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-3.5 w-3.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span className="truncate">Manager: {b.manager || "—"}</span>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Storage</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatBytes(usageByBranchId[b.id] ?? 0)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-1.5 rounded-full bg-slate-900 dark:bg-slate-100"
                    style={{
                      width: `${Math.min(100, ((usageByBranchId[b.id] ?? 0) / (10 * 1024 * 1024 * 1024)) * 100)}%`,
                    }}
                  />
                </div>

                <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                  Created: {formatDateTime(b.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={closeAddDialog}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Add New Branch
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Create a new company branch
                </div>
              </div>
              <button
                onClick={closeAddDialog}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Branch Name
                </div>
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Samreboi Branch"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Branch Code
                </div>
                <input
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value)}
                  placeholder="NY-001"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Location
                </div>
                <input
                  value={addLocation}
                  onChange={(e) => setAddLocation(e.target.value)}
                  placeholder="Samreboi, Amenfi West"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeAddDialog}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                Cancel
              </button>
              <button
                onClick={createBranch}
                disabled={creating}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {creating ? "Creating…" : "Create Branch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={closeEditDialog}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Edit Branch
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Update branch details
                </div>
              </div>
              <button
                onClick={closeEditDialog}
                disabled={editSaving}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Branch Name
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Samreboi Branch"
                  disabled={editSaving}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Location
                </div>
                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Samreboi, Amenfi West"
                  disabled={editSaving}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeEditDialog}
                disabled={editSaving}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                Cancel
              </button>
              <button
                onClick={submitEditBranch}
                disabled={editSaving}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
