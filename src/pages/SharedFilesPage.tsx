import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Share2,
  Search,
  Clock,
  ExternalLink,
  Download,
  Edit3,
  Trash2,
  FileText,
  User as UserIcon,
  Calendar,
  ShieldCheck,
  AlertCircle,
  MoreVertical,
  Lock
} from "lucide-react";

import ActionDropdown from "../components/ActionDropdown";
import { ApiError, apiFetch, apiFetchBlob } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

type SharedWithMeOut = {
  id: number;
  file_name: string;
  file_path: string;
  role: "READ_ONLY" | "EDITOR";
  shared_by: string;
  shared_by_branch: string;
  shared_at: string;
  expires_at?: string | null;
  status: "ACTIVE" | "EXPIRED";
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function SharedFilesPage() {
  usePageTitle("Shared Files");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SharedWithMeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SharedWithMeOut[]>(
        "/files/shared-with-me",
        { method: "GET" },
        { auth: true },
      );
      setRows(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Failed to load shared files");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.file_name.toLowerCase().includes(s));
  }, [q, rows]);

  async function viewFile(row: SharedWithMeOut) {
    const blob = await apiFetchBlob(
      `/files/content?file_path=${encodeURIComponent(row.file_path)}`,
      { method: "GET" },
      { auth: true },
    );
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function downloadFile(row: SharedWithMeOut) {
    const blob = await apiFetchBlob(
      `/files/download?file_path=${encodeURIComponent(row.file_path)}`,
      { method: "GET" },
      { auth: true },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = row.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function editFile(row: SharedWithMeOut) {
    const newName = window.prompt("Rename file", row.file_name);
    if (!newName) return;
    await apiFetch(
      "/files/rename",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: row.file_path, new_name: newName }),
      },
      { auth: true },
    );
    await load();
  }

  async function deleteShare(row: SharedWithMeOut) {
    const ok = window.confirm("Remove this shared file from your list?");
    if (!ok) return;
    await apiFetch(
      `/files/shares/${row.id}`,
      { method: "DELETE" },
      { auth: true },
    );
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 max-w-2xl relative group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-primary transition-colors" size={20} />
           <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search within shared assets..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-primary/10 transition-all outline-none shadow-sm font-bold"
           />
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
           <Share2 size={16} className="text-emerald-primary" />
           <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">
             {filtered.length} Shared Items
           </span>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-800 font-bold dark:bg-rose-950/20 dark:border-rose-900">
          {error}
        </motion.div>
      )}

      <div className="rounded-3xl glass-effect overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">File Reference</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Permission</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Source</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Expiry</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-slate-50 dark:bg-slate-800 rounded-full w-3/4" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                     <FileText className="mx-auto mb-4 text-slate-200" size={48} />
                     <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Zero shared assets detected</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const isReadOnly = r.role === "READ_ONLY";
                  const isExpired = r.status === "EXPIRED" || (r.expires_at ? new Date(r.expires_at).getTime() < Date.now() : false);

                  return (
                    <tr key={r.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors shadow-inner ${isExpired ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-500 dark:bg-slate-800'}`}>
                             <FileText size={24} />
                          </div>
                          <div className="min-w-0">
                            <div className={`font-black uppercase tracking-tight truncate ${isExpired ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                              {r.file_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-2 mt-0.5 uppercase tracking-widest">
                               <Calendar size={12} />
                               {formatDateTime(r.shared_at)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                         <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${isReadOnly ? 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-900 dark:border-slate-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900'}`}>
                            {isReadOnly ? <Lock size={10} /> : <ShieldCheck size={10} />}
                            {r.role.replace('_', ' ')}
                         </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-tight">
                           <UserIcon size={14} className="text-slate-300" />
                           {r.shared_by}
                           {r.shared_by_branch && <span className="text-[10px] text-slate-400 italic font-medium lowercase">from {r.shared_by_branch}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                         {r.expires_at ? (
                           <div className={`flex items-center gap-2 text-xs font-bold ${isExpired ? 'text-rose-500' : 'text-slate-500'}`}>
                              {isExpired ? <AlertCircle size={14} /> : <Clock size={14} className="text-slate-300" />}
                              {formatDateOnly(r.expires_at)}
                           </div>
                         ) : (
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Permanent</span>
                         )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <ActionDropdown
                          items={[
                            { label: "Launch Viewer", icon: ExternalLink, onClick: () => viewFile(r), disabled: isExpired },
                            { label: "Download Sync", icon: Download, onClick: () => downloadFile(r), disabled: isReadOnly || isExpired },
                            { label: "Modify Draft", icon: Edit3, onClick: () => editFile(r), disabled: isReadOnly || isExpired },
                            { type: "separator" },
                            { label: "Remove Link", icon: Trash2, danger: true, onClick: () => deleteShare(r) },
                          ]}
                          buttonLabel={<MoreVertical size={18} className="text-slate-300 group-hover:text-slate-600 transition-colors" />}
                          buttonClassName="!bg-transparent !p-2 !shadow-none hover:!bg-white dark:hover:!bg-slate-800 !rounded-xl"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
