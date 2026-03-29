import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Users,
  Plus,
  Search,
  X
} from "lucide-react";

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
  const navigate = useNavigate();
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Branch Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage company branches and storage locations.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={openAddDialog}
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 transition-all">
            <Plus className="h-5 w-5" />
            {creating ? "Adding…" : "Add Branch"}
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
          <Search className="h-4 w-4" />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search branches by name, code, or location…"
          className="w-full rounded-2xl border border-slate-100 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-600 shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white py-20 text-center dark:border-slate-800 dark:bg-slate-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-primary border-t-transparent" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading branches...</p>
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white px-4 py-20 text-center dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-slate-900/30">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-950 dark:text-slate-50">No branches found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try adjusting your search or add a new branch.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className="group relative flex flex-col rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-xl hover:shadow-emerald-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:shadow-none">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-primary transition-colors dark:bg-slate-900/30 dark:text-slate-400 dark:group-hover:bg-emerald-950/30 dark:group-hover:text-emerald-400 font-bold">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-900 dark:text-slate-50">
                      {b.name}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {b.code || `BR-${b.id}`}
                    </p>
                  </div>
                </div>

                <ActionDropdown
                  items={
                    [
                      {
                        label: "View Files",
                        onClick: () => {
                          navigate(`/file-manager?branch_id=${encodeURIComponent(String(b.id))}`);
                        },
                      },
                      {
                        label: "Export Zip",
                        onClick: () => exportFiles(b.id, b.name),
                        disabled: exporting,
                      },
                      {
                        label: "Edit Details",
                        onClick: () => openEditDialog(b),
                        disabled: !isSuperAdmin,
                      },
                      {
                        label: "Delete Branch",
                        danger: true,
                        onClick: () => deleteBranch(b.id, b.name),
                        disabled: !isSuperAdmin,
                      },
                    ] satisfies ActionDropdownItem[] as ActionDropdownItem[]
                  }
                  buttonLabel="Actions"
                  buttonClassName="!rounded-xl !border !border-slate-100 !bg-white !px-3 !py-1.5 !text-xs !font-bold !text-slate-700 !shadow-sm hover:!bg-slate-50 dark:!border-slate-800 dark:!bg-slate-900 dark:!text-slate-200 dark:hover:!bg-slate-800 transition-all"
                />
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{b.location || "No location set"}</span>
                </div>

                <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="truncate">
                    {b.manager ? `Manager: ${b.manager}` : "No managers assigned"}
                  </span>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-50 pt-5 dark:border-slate-800/50">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-500">Storage Usage</span>
                  <span className="font-bold text-slate-950 dark:text-slate-50">
                    {formatBytes(usageByBranchId[b.id] ?? 0)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-50 dark:bg-slate-900/30 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-primary transition-all"
                    style={{
                      width: `${Math.min(100, ((usageByBranchId[b.id] ?? 0) / (10 * 1024 * 1024 * 1024)) * 100)}%`,
                    }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-black">
                  <span>Created</span>
                  <span>{formatDateTime(b.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Branch Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/20 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-slate-50">
                  Add New Branch
                </h3>
                <p className="text-sm font-bold text-slate-500">
                  Register a new physical branch.
                </p>
              </div>
              <button
                onClick={closeAddDialog}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                  Branch Name
                </label>
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Samreboi HQ"
                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 font-bold shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                  Branch Code
                </label>
                <input
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value)}
                  placeholder="e.g. SMB-001"
                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 font-bold shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                  Location
                </label>
                <input
                  value={addLocation}
                  onChange={(e) => setAddLocation(e.target.value)}
                  placeholder="e.g. Amenfi West District"
                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 font-bold shadow-sm"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={closeAddDialog}
                className="flex-1 rounded-2xl border border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 transition-all">
                Cancel
              </button>
              <button
                onClick={createBranch}
                disabled={creating}
                className="flex-1 rounded-2xl bg-emerald-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100 dark:shadow-none">
                {creating ? "Creating..." : "Create Branch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/20 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-slate-50">
                  Edit Branch
                </h3>
                <p className="text-sm font-bold text-slate-500">
                  Update branch information.
                </p>
              </div>
              <button
                onClick={closeEditDialog}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-sky-900/30">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                  Branch Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={editSaving}
                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 disabled:opacity-50 font-bold shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                  Location
                </label>
                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  disabled={editSaving}
                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 disabled:opacity-50 font-bold shadow-sm"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={closeEditDialog}
                disabled={editSaving}
                className="flex-1 rounded-2xl border border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 transition-all">
                Cancel
              </button>
              <button
                onClick={submitEditBranch}
                disabled={editSaving}
                className="flex-1 rounded-2xl bg-emerald-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100 dark:shadow-none">
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
