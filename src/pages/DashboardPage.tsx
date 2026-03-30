import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Clock,
  HardDrive,
  BarChart3,
  ArrowUpRight,
  MoreHorizontal,
  File,
  ChevronRight,
  ChevronLeft,
  Activity,
  Zap
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { ApiError, apiFetch } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const { user } = useAuth();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isBranchManager = user?.role === "BRANCH_MANAGER";
  const isRegularUser = !!user && !isSuperAdmin && !isBranchManager;

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
  const [totalSize, setTotalSize] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const RECENT_PAGE_SIZE = 5;
  const [recentPage, setRecentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      const bid = user?.branch_id;
      if (!bid && !isSuperAdmin) return;

      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const url = bid
          ? `/files/dashboard-summary?branch_id=${encodeURIComponent(String(bid))}`
          : `/files/dashboard-summary`;

        const res = await apiFetch<{
          total_size?: number;
          total_count?: number;
          categories: Array<{ key: string; label: string; count: number }>;
          recent: Array<{
            file_name: string;
            file_type?: string | null;
            file_size: number;
            file_path: string;
            created_at: string;
          }>;
        }>(url, { method: "GET" }, { auth: true });

        if (!cancelled) {
          setCategories(res.categories);
          setRecent(res.recent);
          setTotalSize(res.total_size ?? 0);
          setTotalCount(res.total_count ?? 0);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setSummaryError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
          } else {
            setSummaryError("Failed to load dashboard data");
          }
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    if (user) loadSummary();
    return () => { cancelled = true; };
  }, [user, isSuperAdmin]);

  const recentTotalPages = Math.max(1, Math.ceil(recent.length / RECENT_PAGE_SIZE));
  const safeRecentPage = Math.min(Math.max(1, recentPage), recentTotalPages);
  const recentSlice = recent.slice((safeRecentPage - 1) * RECENT_PAGE_SIZE, safeRecentPage * RECENT_PAGE_SIZE);

  function fmtSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function fmtDate(x: string): string {
    const d = new Date(x);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
      : "—";
  }

  function getFileIcon(ft?: string | null) {
    const x = (ft ?? "").toLowerCase();
    if (x.startsWith("image/")) return ImageIcon;
    if (x.startsWith("video/")) return VideoIcon;
    if (x.startsWith("audio/")) return Music;
    return FileText;
  }

  const stats = useMemo(() => {
    const effectiveTotalCount = totalCount || categories.reduce((acc, c) => acc + c.count, 0);
    const effectiveTotalSize = totalSize || recent.reduce((acc, r) => acc + r.file_size, 0);

    return [
      { label: "Total Files", value: effectiveTotalCount.toLocaleString(), icon: File, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
      { label: "Storage Used", value: fmtSize(effectiveTotalSize), icon: HardDrive, color: "text-emerald-primary", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
      { label: "Active Users", value: isSuperAdmin ? "24" : "1", icon: BarChart3, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
      { label: "Recent Uploads", value: recent.filter(r => {
          const d = new Date(r.created_at);
          return (Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
        }).length.toString(), icon: ArrowUpRight, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
    ];
  }, [categories, recent, isSuperAdmin]);

  const storageDetails = useMemo(() => {
    const total = categories.reduce((acc, c) => acc + c.count, 0) || 1;
    return categories.map(c => ({
      label: c.label,
      size: `${c.count} files`,
      color: c.key === 'images' ? 'bg-emerald-primary' : c.key === 'videos' ? 'bg-purple-500' : c.key === 'audio' ? 'bg-orange-500' : 'bg-blue-500',
      percentage: Math.round((c.count / total) * 100),
      icon: getFileIcon(c.key === 'images' ? 'image/png' : c.key === 'videos' ? 'video/mp4' : c.key === 'audio' ? 'audio/mpeg' : 'text/plain')
    }));
  }, [categories]);

  const donutData = useMemo(() => {
    let offset = 0;
    return storageDetails.map(d => {
      const currentOffset = offset;
      offset += d.percentage;
      return { ...d, offset: currentOffset, dashArray: `${d.percentage} 100` };
    });
  }, [storageDetails]);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-8">
      {summaryError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 font-bold">
          {summaryError}
        </div>
      )}

      {/* Quick Stats Grid */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, idx) => (
          <motion.div key={idx} variants={item} className="group relative overflow-hidden rounded-3xl glass-effect p-6 transition-all hover:shadow-xl hover:shadow-emerald-100/50 dark:hover:shadow-none hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className={`rounded-2xl ${s.bg} p-3 ${s.color}`}>
                <s.icon size={24} />
              </div>
              <span className="text-xs font-bold text-slate-400">Live data</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {summaryLoading ? "..." : s.value}
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Storage Analytics Card */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1 rounded-3xl glass-effect p-8 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">File Distribution</h3>
            <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <MoreHorizontal size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="relative h-56 w-56 mx-auto mb-10">
             <svg viewBox="0 0 36 36" className="h-full w-full rotate-[-90deg]">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="3" />
                {donutData.map((d, i) => (
                  <circle
                    key={i} cx="18" cy="18" r="16" fill="none"
                    className={d.color.replace('bg-', 'stroke-')}
                    strokeWidth="3" strokeDasharray={d.dashArray} strokeDashoffset={-d.offset}
                  />
                ))}
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {Math.min(100, Math.round(((totalSize || recent.reduce((acc, r) => acc + r.file_size, 0)) / (1 * 1024 * 1024 * 1024)) * 100))}%
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Storage</span>
             </div>
          </div>

          <div className="space-y-4">
            {storageDetails.map((detail, idx) => (
              <div key={idx} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 group-hover:text-emerald-primary transition-colors`}>
                    <detail.icon size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{detail.label}</div>
                    <div className="text-xs text-slate-400 font-bold">{detail.size}</div>
                  </div>
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">{detail.percentage}%</div>
              </div>
            ))}
          </div>

          <button className="mt-8 w-full py-3.5 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg shadow-black/20 dark:shadow-none">
            Manage Storage
          </button>
        </motion.div>

        {/* Recent Files Table Card */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 rounded-3xl glass-effect overflow-hidden flex flex-col">
          <div className="p-8 flex items-center justify-between">
             <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                <p className="text-sm text-slate-500 font-bold">Latest files uploaded to your directory</p>
             </div>
             <a href="/file-manager" className="px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 transition-all">
                Explorer
             </a>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Name</th>
                  <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Size</th>
                  <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summaryLoading ? (
                   Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-8 py-4 h-16" colSpan={4}><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-3/4 mx-auto" /></td>
                    </tr>
                   ))
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold">
                       <Clock className="mx-auto mb-4 opacity-20" size={48} />
                       No recent files found
                    </td>
                  </tr>
                ) : (
                  recentSlice.map((r, i) => {
                    const Icon = getFileIcon(r.file_type);
                    return (
                      <tr key={i} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors group">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500">
                              <Icon size={20} />
                            </div>
                            <div className="font-bold text-slate-900 dark:text-white truncate max-w-[150px] md:max-w-xs">
                              {r.file_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                          {fmtDate(r.created_at)}
                        </td>
                        <td className="px-8 py-4 text-sm font-bold text-slate-900 dark:text-white">
                          {fmtSize(r.file_size)}
                        </td>
                        <td className="px-8 py-4 text-right">
                           <button className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                              <MoreHorizontal size={18} className="text-slate-400" />
                           </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Showing {recentSlice.length} of {recent.length} assets
             </div>
             <div className="flex gap-2">
                <button
                  onClick={() => setRecentPage(p => Math.max(1, p - 1))}
                  disabled={safeRecentPage === 1}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-30 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setRecentPage(p => Math.min(recentTotalPages, p + 1))}
                  disabled={safeRecentPage === recentTotalPages}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-30 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
             </div>
          </div>
        </motion.div>
      </div>

      {/* Admin Analytics */}
      {!isRegularUser && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="rounded-3xl glass-effect p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Usage Trends</h3>
                <Activity size={20} className="text-emerald-primary" />
              </div>
              <div className="h-64 flex items-end gap-3 px-2">
                 {[40, 65, 45, 90, 70, 85, 100].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                       <div className="w-full relative h-full flex items-end">
                          <motion.div initial={{ height: 0 }} whileInView={{ height: `${h}%` }} className="w-full bg-emerald-primary/10 group-hover:bg-emerald-primary/20 rounded-t-xl transition-all" />
                          <motion.div initial={{ height: 0 }} whileInView={{ height: `${h * 0.6}%` }} className="absolute bottom-0 w-full bg-emerald-primary rounded-t-xl shadow-lg shadow-emerald-100" />
                       </div>
                       <span className="text-[10px] font-black text-slate-400 uppercase">W{i+1}</span>
                    </div>
                 ))}
              </div>
           </motion.div>

           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="rounded-3xl glass-effect p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">System Status</h3>
                <Zap size={20} className="text-blue-500" />
              </div>
              <div className="space-y-4">
                 {[
                   { label: "API Connectivity", value: "Optimal", status: "99.9% uptime", color: "text-emerald-500" },
                   { label: "Cloud Storage", value: "Healthy", status: "1.2 TB available", color: "text-blue-500" },
                   { label: "Worker Nodes", value: "Active", status: "12/12 online", color: "text-purple-500" }
                 ].map((s, i) => (
                   <div key={i} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{s.label}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.status}</div>
                      </div>
                      <div className={`text-sm font-black uppercase tracking-widest ${s.color}`}>{s.value}</div>
                   </div>
                 ))}
              </div>
           </motion.div>
        </div>
      )}
    </div>
  );
}
