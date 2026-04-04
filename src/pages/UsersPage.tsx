import { useEffect, useMemo, useState } from "react";

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
  if (role === "SUPER_ADMIN") {
    return {
      text: "Super Admin",
      className: "bg-rose-100 text-rose-700 border-rose-200",
    };
  }
  if (role === "BRANCH_MANAGER") {
    return {
      text: "Branch Manager",
      className: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };
  }
  if (role === "COORDINATOR") {
    return {
      text: "Coordinator",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }
  if (role === "LOAN_OFFICER") {
    return {
      text: "Loan Officer",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }
  if (role === "CUSTOMER_RELATION") {
    return {
      text: "Customer Relation",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }
  if (role === "ACCOUNTANT") {
    return {
      text: "Accountant",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }
  if (role === "CASHIER") {
    return {
      text: "Cashier",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }
  return {
    text: role,
    className: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function initials(name: string): string {
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
  const [branchesError, setBranchesError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

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
    setBranchesError(null);
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
          if (err instanceof ApiError) {
            setBranchesError(
              `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
            );
          } else {
            setBranchesError("Failed to load branches");
          }
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            User Management
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Manage users and their permissions
          </div>
        </div>

        {isSuperAdmin || isBranchManager ? (
          <button
            onClick={openAddDialog}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
            <span className="text-base leading-none">+</span>
            Add User
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:flex-1">
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users by name, username, or email..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        {!isBranchManager ? (
          <select
            value={filterBranchId}
            onChange={(e) =>
              setFilterBranchId(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100 md:w-56">
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100 md:w-56">
          <option value="">All Roles</option>
          {ROLE_OPTIONS.filter((r) =>
            isBranchManager
              ? r.value !== "SUPER_ADMIN" && r.value !== "BRANCH_MANAGER"
              : true,
          ).map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="sfms-listing-card rounded-md">
        <div className="overflow-auto">
          <table className="sfms-table text-[11px]">
            <thead className="sfms-thead">
              <tr>
                <th className="sfms-th !px-2 !py-1.5">User</th>
                <th className="sfms-th !px-2 !py-1.5">Role</th>
                <th className="sfms-th !px-2 !py-1.5">Branch</th>
                <th className="sfms-th !px-2 !py-1.5">Status</th>
                <th className="sfms-th !px-2 !py-1.5">Created</th>
                <th className="sfms-th !px-2 !py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="sfms-td py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    colSpan={6}>
                    Loading users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    className="sfms-td py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    colSpan={6}>
                    No users found.
                  </td>
                </tr>
              ) : (
                paged.map((u) => {
                  const badge = roleBadge(u.role);
                  const branchText =
                    u.role === "SUPER_ADMIN"
                      ? "All Branches"
                      : (branchNameById.get(u.branch_id) ??
                        `Branch ${u.branch_id}`);

                  return (
                    <tr key={u.id} className="sfms-tr">
                      <td className="sfms-td !px-2 !py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            {initials(u.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                              {u.name}
                            </div>
                            <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="sfms-td !px-2 !py-1.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badge.className}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="sfms-td !px-2 !py-1.5 text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-2">
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
                          {branchText}
                        </span>
                      </td>
                      <td className="sfms-td !px-2 !py-1.5">
                        <span className="inline-flex items-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          Active
                        </span>
                      </td>
                      <td className="sfms-td !px-2 !py-1.5 text-slate-700 dark:text-slate-300">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="sfms-td !px-2 !py-1.5 text-right">
                        <ActionDropdown
                          items={
                            [
                              {
                                label: "Edit",
                                onClick: () => openEditDialog(u),
                              },
                              ...(isSuperAdmin
                                ? ([
                                    { type: "separator" },
                                    {
                                      label: "Delete",
                                      danger: true,
                                      disabled:
                                        currentUserId != null &&
                                        u.id === currentUserId,
                                      onClick: () => deleteUserRow(u),
                                    },
                                  ] satisfies ActionDropdownItem[])
                                : ([] satisfies ActionDropdownItem[])),
                            ] satisfies ActionDropdownItem[] as ActionDropdownItem[]
                          }
                          buttonLabel="Edit | Details"
                          buttonClassName="!bg-white !text-red-600 !border !border-red-500 !shadow-none hover:!bg-red-50 dark:!bg-slate-950 dark:hover:!bg-rose-950/20 !px-2 !py-1"
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

      {!loading && filtered.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filtered.length)} of{" "}
            {filtered.length}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
              Prev
            </button>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Page {safePage} / {pageCount}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
              Next
            </button>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={closeAddDialog}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-brand-800 dark:bg-brand-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Add New User
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Create a new user account
                </div>
              </div>
              <button
                onClick={closeAddDialog}
                disabled={creating}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Full Name
                </div>
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="John Doe"
                  disabled={creating}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Username
                </div>
                <input
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="jdoe"
                  disabled={creating}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Email
                </div>
                <input
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="john@company.com"
                  disabled={creating}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Password
                </div>
                <input
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="********"
                  disabled={creating}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Role
                  </div>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    disabled={creating}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100">
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Branch
                  </div>
                  <select
                    value={addBranchId}
                    onChange={(e) =>
                      setAddBranchId(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                    disabled={creating || addRole === "SUPER_ADMIN"}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100">
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {branchesError ? (
                    <div className="mt-1 text-[11px] text-rose-700">
                      {branchesError}
                    </div>
                  ) : null}
                </label>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-slate-900">
                    Active Account
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Controls login availability
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddActive((v) => !v)}
                  disabled={creating}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    addActive ? "bg-slate-900" : "bg-slate-200"
                  } disabled:cursor-not-allowed disabled:opacity-60`}>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      addActive ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {createError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {createError}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeAddDialog}
                disabled={creating}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
                Cancel
              </button>
              <button
                onClick={submitAddUser}
                disabled={creating}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {creating ? "Creating…" : "Create User"}
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
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-brand-800 dark:bg-brand-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Edit User
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Update user account details
                </div>
              </div>
              <button
                onClick={closeEditDialog}
                disabled={updating}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Full Name
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={updating}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Username
                </div>
                <input
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  disabled={updating}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Email
                </div>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={updating}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  New Password (optional)
                </div>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  disabled={updating}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Role
                  </div>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    disabled={updating}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100">
                    {ROLE_OPTIONS.filter((r) =>
                      isBranchManager
                        ? r.value !== "SUPER_ADMIN" &&
                          r.value !== "BRANCH_MANAGER"
                        : true,
                    ).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                {isSuperAdmin ? (
                  <label className="block">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      Branch
                    </div>
                    <select
                      value={editBranchId}
                      onChange={(e) =>
                        setEditBranchId(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      disabled={updating || editRole === "SUPER_ADMIN"}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-100">
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    {branchesError ? (
                      <div className="mt-1 text-[11px] text-rose-700">
                        {branchesError}
                      </div>
                    ) : null}
                  </label>
                ) : null}
              </div>

              {updateError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {updateError}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeEditDialog}
                disabled={updating}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950 dark:text-slate-200 dark:hover:bg-slate-900">
                Cancel
              </button>
              <button
                onClick={submitEditUser}
                disabled={updating}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {updating ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
