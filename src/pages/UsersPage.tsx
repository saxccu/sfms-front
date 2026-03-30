import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Plus,
  Mail,
  Shield,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  Edit3,
  Trash2,
  Lock,
  User as UserIcon,
  MoreVertical
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { ApiError, apiFetch } from "../lib/api";
import ActionDropdown, {
  type ActionDropdownItem,
} from "../components/ActionDropdown";
import { usePageTitle } from "../hooks/usePageTitle";

type BranchOut = {
  id: number;
  name: string;
  created_at: string;
};

type UserOut = {
  id: number;
  name: string;
  username?: string | null;
  email: string;
  role: string;
  branch_id: number;
  created_at: string;
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "BRANCH_MANAGER", label: "Branch Manager" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "LOAN_OFFICER", label: "Loan Officer" },
  { value: "COORDINATOR", label: "Coordinator" },
  { value: "CUSTOMER_RELATION", label: "Customer Relation" },
  { value: "CASHIER", label: "Cashier" },
];

function roleBadge(role: string): { text: string; className: string } {
  const base = "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm";
  if (role === "SUPER_ADMIN") {
    return {
      text: "Super Admin",
      className: `${base} bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900`,
    };
  }
  if (role === "BRANCH_MANAGER") {
    return {
      text: "Branch Manager",
      className: `${base} bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900`,
    };
  }
  if (role === "COORDINATOR") {
    return {
      text: "Coordinator",
      className: `${base} bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900`,
    };
  }
  return {
    text: role.replace('_', ' '),
    className: `${base} bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/50 dark:border-slate-800`,
  };
}


function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const a = parts[0]?.[0] ?? "U";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

export default function UsersPage() {
  usePageTitle("Users");
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filterBranchId, setFilterBranchId] = useState<number | "">("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [rows, setRows] = useState<UserOut[]>([]);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 8;

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isBranchManager = user?.role === "BRANCH_MANAGER";
  const currentUserId = user?.id ?? null;
  const currentBranchId = user?.branch_id ?? null;

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState("CUSTOMER_RELATION");
  const [addBranchId, setAddBranchId] = useState<number | "">("");
  const [addActive, setAddActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("CUSTOMER_RELATION");
  const [editBranchId, setEditBranchId] = useState<number | "">("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const branchNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const b of branches) map.set(b.id, b.name);
    return map;
  }, [branches]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const usersRes = await apiFetch<UserOut[]>(
        "/users",
        { method: "GET" },
        { auth: true },
      );
      setRows(usersRes);

      try {
        const branchesRes = await apiFetch<BranchOut[]>(
          "/branches",
          { method: "GET" },
          { auth: true },
        );
        setBranches(branchesRes);
      } catch (err) {
        setBranches([]);
        if (!isBranchManager) {
          // ignore
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteUserRow(u: UserOut) {
    const ok = window.confirm(`Delete user "${u.name}"?`);
    if (!ok) return;
    try {
      await apiFetch(
        `/users/${encodeURIComponent(String(u.id))}`,
        { method: "DELETE" },
        { auth: true },
      );
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Failed to delete user");
      }
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (addRole === "SUPER_ADMIN") {
      setAddBranchId("");
    }
  }, [addRole]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((u) => {
      if (filterRole && u.role !== filterRole) return false;
      if (filterBranchId !== "" && u.branch_id !== filterBranchId) return false;
      if (!s) return true;
      return (
        u.name.toLowerCase().includes(s) ||
        (u.username ?? "").toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s)
      );
    });
  }, [q, rows, filterBranchId, filterRole]);

  useEffect(() => {
    setPage(1);
  }, [q, filterBranchId, filterRole]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  function openAddDialog() {
    setCreateError(null);
    setAddName("");
    setAddUsername("");
    setAddEmail("");
    setAddPassword("");
    setAddRole("CUSTOMER_RELATION");
    setAddBranchId("");
    setAddActive(true);
    setAddOpen(true);
  }

  function closeAddDialog() {
    if (creating) return;
    setAddOpen(false);
  }

  function openEditDialog(u: UserOut) {
    setUpdateError(null);
    setEditUser(u);
    setEditName(u.name ?? "");
    setEditUsername((u.username ?? "").toString());
    setEditEmail(u.email ?? "");
    setEditPassword("");
    setEditRole(u.role ?? "CUSTOMER_RELATION");
    setEditBranchId(u.branch_id ?? "");
    setEditOpen(true);
  }

  function closeEditDialog() {
    if (updating) return;
    setEditOpen(false);
  }

  async function submitEditUser() {
    if (!editUser) return;
    const name = editName.trim();
    const username = editUsername.trim();
    const email = editEmail.trim();
    const password = editPassword;

    if (!name) {
      setUpdateError("Full name is required");
      return;
    }
    if (!username) {
      setUpdateError("Username is required");
      return;
    }
    if (!email) {
      setUpdateError("Email is required");
      return;
    }

    if (password && password.length < 8) {
      setUpdateError("Password must be at least 8 characters");
      return;
    }

    if (isBranchManager) {
      if (editRole === "SUPER_ADMIN" || editRole === "BRANCH_MANAGER") {
        setUpdateError("Not authorized");
        return;
      }
      if (
        currentBranchId &&
        editBranchId !== "" &&
        Number(editBranchId) !== currentBranchId
      ) {
        setUpdateError("Not authorized");
        return;
      }
    }

    setUpdating(true);
    setUpdateError(null);
    try {
      await apiFetch<UserOut>(
        `/users/${encodeURIComponent(String(editUser.id))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            username,
            email,
            role: editRole,
            ...(isSuperAdmin && editBranchId !== ""
              ? { branch_id: Number(editBranchId) }
              : {}),
            ...(password ? { password } : {}),
          }),
        },
        { auth: true },
      );
      setEditOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setUpdateError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setUpdateError("Failed to update user");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function submitAddUser() {
    const name = addName.trim();
    const username = addUsername.trim();
    const email = addEmail.trim();
    const password = addPassword;

    if (!name) {
      setCreateError("Full name is required");
      return;
    }
    if (!email) {
      setCreateError("Email is required");
      return;
    }

    if (!username) {
      setCreateError("Username is required");
      return;
    }
    if (!password || password.length < 8) {
      setCreateError("Password must be at least 8 characters");
      return;
    }
    if (isBranchManager) {
      if (!currentBranchId) {
        setCreateError("Branch is required");
        return;
      }
      if (addRole === "SUPER_ADMIN" || addRole === "BRANCH_MANAGER") {
        setCreateError("Not authorized");
        return;
      }
    } else if (addRole !== "SUPER_ADMIN") {
      if (addBranchId === "" || Number.isNaN(Number(addBranchId))) {
        setCreateError("Branch is required");
        return;
      }
    }

    const resolvedBranchId = isBranchManager
      ? currentBranchId
      : addRole === "SUPER_ADMIN"
        ? branches[0]?.id
        : addBranchId === ""
          ? undefined
          : Number(addBranchId);

    if (resolvedBranchId == null || Number.isNaN(Number(resolvedBranchId))) {
      setCreateError("Branch is required");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch<UserOut>(
        "/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            username,
            email,
            password,
            role: addRole,
            branch_id: Number(resolvedBranchId),
          }),
        },
        { auth: true },
      );
      setAddOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setCreateError("Failed to create user");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 max-w-2xl relative group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-primary transition-colors" size={20} />
           <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users by name, username, or email..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-primary/10 transition-all outline-none shadow-sm font-bold"
           />
        </div>

        <div className="flex items-center gap-3">
           {!isBranchManager && (
             <div className="relative group">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-emerald-primary transition-colors" size={16} />
                <select
                  value={filterBranchId}
                  onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : "")}
                  className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 focus:ring-emerald-primary transition-all shadow-sm appearance-none"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
             </div>
           )}

           <div className="relative group">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-emerald-primary transition-colors" size={16} />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 focus:ring-emerald-primary transition-all shadow-sm appearance-none"
              >
                <option value="">All Roles</option>
                {ROLE_OPTIONS.filter((r) =>
                  isBranchManager ? r.value !== "SUPER_ADMIN" && r.value !== "BRANCH_MANAGER" : true
                ).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
           </div>

           {(isSuperAdmin || isBranchManager) && (
              <button
                onClick={openAddDialog}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition-all whitespace-nowrap"
              >
                <Plus size={18} />
                <span>Add User</span>
              </button>
           )}
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
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Identity</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Position</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Workplace</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-8"><div className="h-4 bg-slate-50 dark:bg-slate-800 rounded-full w-3/4" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                     <Users className="mx-auto mb-4 text-slate-200" size={48} />
                     <p className="text-slate-400 font-bold">No users identified in this sector</p>
                  </td>
                </tr>
              ) : (
                paged.map((u) => {
                  const badge = roleBadge(u.role);
                  const branchText = u.role === "SUPER_ADMIN" ? "Universal Access" : (branchNameById.get(u.branch_id) || "Unassigned");

                  return (
                    <tr key={u.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 font-black text-xs dark:bg-slate-800 transition-colors group-hover:bg-white group-hover:text-emerald-primary shadow-inner">
                            {getInitials(u.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight truncate">
                              {u.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-bold flex items-center gap-2 mt-0.5">
                               <Mail size={12} />
                               {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={badge.className}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                           <MapPin size={14} className="text-slate-300" />
                           {branchText}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ActionDropdown
                          items={[
                            { label: "Edit Protocol", icon: Edit3, onClick: () => openEditDialog(u) },
                            ...(isSuperAdmin ? [
                              { type: "separator" },
                              {
                                label: "Revoke Access",
                                icon: Trash2,
                                danger: true,
                                disabled: currentUserId != null && u.id === currentUserId,
                                onClick: () => deleteUserRow(u),
                              },
                            ] : []) as ActionDropdownItem[]
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

      {!loading && filtered.length > pageSize && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Records {(safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-30 transition-all hover:bg-slate-50 shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-black text-slate-900 dark:text-white">
              {safePage} / {pageCount}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-30 transition-all hover:bg-slate-50 shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <AnimatePresence>
        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeAddDialog} className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-950 rounded-[40px] p-10 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
                <div className="flex items-center justify-between mb-8">
                   <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Onboard User</h2>
                      <p className="text-sm font-bold text-slate-500 mt-1">Configure security credentials and sector</p>
                   </div>
                   <button onClick={closeAddDialog} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                </div>

                <div className="space-y-5">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Identity</label>
                         <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Samuel Amite" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none" />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username</label>
                         <input value={addUsername} onChange={(e) => setAddUsername(e.target.value)} placeholder="sam.amite" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none" />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Connection</label>
                      <div className="relative">
                         <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                         <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="name@saxccu.com" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none" />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Secure Passkey</label>
                      <div className="relative">
                         <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                         <input type="password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} placeholder="••••••••••••" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Clearance Level</label>
                         <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none appearance-none">
                            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Operation Sector</label>
                         <select value={addBranchId} onChange={(e) => setAddBranchId(e.target.value ? Number(e.target.value) : "")} disabled={addRole === "SUPER_ADMIN"} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none appearance-none disabled:opacity-30">
                            <option value="">Select Sector</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                         </select>
                      </div>
                   </div>

                   <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800">
                      <div>
                         <div className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Active Status</div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Enables system entry</div>
                      </div>
                      <button onClick={() => setAddActive(!addActive)} className={`relative w-12 h-6 rounded-full transition-all ${addActive ? 'bg-emerald-primary' : 'bg-slate-200'}`}>
                         <motion.div animate={{ x: addActive ? 26 : 2 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </button>
                   </div>

                   {createError && <p className="text-rose-600 text-xs font-bold text-center">{createError}</p>}

                   <button onClick={submitAddUser} disabled={creating} className="w-full py-4 bg-emerald-primary text-white font-black rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-600 transition-all uppercase tracking-[0.2em] mt-4">
                      {creating ? "Synchronizing..." : "Finalize Onboarding"}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeEditDialog} className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-950 rounded-[40px] p-10 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
                <div className="flex items-center justify-between mb-8">
                   <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Modify Protocol</h2>
                      <p className="text-sm font-bold text-slate-500 mt-1">Update security clearace and metadata</p>
                   </div>
                   <button onClick={closeEditDialog} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                </div>

                <div className="space-y-5">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identity</label>
                         <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username</label>
                         <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none" />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">System Email</label>
                      <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none" />
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rotate Passkey <span className="text-[9px] lowercase italic opacity-60">(Leave empty to retain current)</span></label>
                      <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••••••" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none" />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Clearance Role</label>
                         <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none appearance-none">
                            {ROLE_OPTIONS.filter((r) => isBranchManager ? r.value !== "SUPER_ADMIN" && r.value !== "BRANCH_MANAGER" : true).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                         </select>
                      </div>
                      {isSuperAdmin && (
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Deployment Sector</label>
                           <select value={editBranchId} onChange={(e) => setEditBranchId(e.target.value ? Number(e.target.value) : "")} disabled={editRole === "SUPER_ADMIN"} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 font-bold text-sm outline-none appearance-none disabled:opacity-30">
                              <option value="">Select Sector</option>
                              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                           </select>
                        </div>
                      )}
                   </div>

                   {updateError && <p className="text-rose-600 text-xs font-bold text-center">{updateError}</p>}

                   <button onClick={submitEditUser} disabled={updating} className="w-full py-4 bg-emerald-primary text-white font-black rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-600 transition-all uppercase tracking-[0.2em] mt-4">
                      {updating ? "Processing..." : "Commit Changes"}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
