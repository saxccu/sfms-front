import { useEffect, useMemo, useState } from "react";

import ActionDropdown, {
  type ActionDropdownItem,
} from "../components/ActionDropdown";
import { ApiError, apiFetch, apiFetchBlob } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

usePageTitle("Shared Files");

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Shared files
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Files that were shared with you
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="relative">
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
          placeholder="Search shared files..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div className="sfms-listing-card rounded-md">
        <div className="overflow-auto">
          <table className="sfms-table">
            <thead className="sfms-thead">
              <tr>
                <th className="sfms-th">S/N</th>
                <th className="sfms-th">File name</th>
                <th className="sfms-th">Role</th>
                <th className="sfms-th">Share by</th>
                <th className="sfms-th">Date</th>
                <th className="sfms-th">Expire date</th>
                <th className="sfms-th">Status</th>
                <th className="sfms-th text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="sfms-td py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    colSpan={8}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    className="sfms-td py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    colSpan={8}>
                    No shared files.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const isReadOnly = r.role === "READ_ONLY";
                  const isExpired =
                    r.status === "EXPIRED" ||
                    (r.expires_at
                      ? new Date(r.expires_at).getTime() < Date.now()
                      : false);
                  const items: ActionDropdownItem[] = [
                    {
                      label: "View",
                      onClick: () => viewFile(r),
                      disabled: isExpired,
                    },
                    ...(isReadOnly
                      ? ([] as ActionDropdownItem[])
                      : ([
                          {
                            label: "Download",
                            onClick: () => downloadFile(r),
                            disabled: isExpired,
                          },
                        ] as ActionDropdownItem[])),
                    ...(isReadOnly
                      ? ([] as ActionDropdownItem[])
                      : ([
                          {
                            label: "Edit",
                            onClick: () => editFile(r),
                            disabled: isExpired,
                          },
                        ] as ActionDropdownItem[])),
                    {
                      label: "Delete",
                      onClick: () => deleteShare(r),
                      danger: true,
                      disabled: isExpired,
                    },
                  ];

                  return (
                    <tr key={r.id} className="sfms-tr">
                      <td className="sfms-td text-slate-700 dark:text-slate-300">
                        {idx + 1}
                      </td>
                      <td className="sfms-td font-medium text-slate-900 dark:text-slate-100">
                        {r.file_name}
                      </td>
                      <td className="sfms-td text-slate-700 dark:text-slate-300">
                        {r.role === "READ_ONLY" ? "Read only" : "Editor"}
                      </td>
                      <td className="sfms-td text-slate-700 dark:text-slate-300">
                        {r.shared_by}
                        {r.shared_by_branch ? ` (${r.shared_by_branch})` : ""}
                      </td>
                      <td className="sfms-td text-slate-700 dark:text-slate-300">
                        {formatDateTime(r.shared_at)}
                      </td>
                      <td className="sfms-td text-slate-700 dark:text-slate-300">
                        {formatDateOnly(r.expires_at)}
                      </td>
                      <td className="sfms-td text-slate-700 dark:text-slate-300">
                        {isExpired ? "Expired" : "Active"}
                      </td>
                      <td className="sfms-td text-right">
                        <ActionDropdown
                          items={items}
                          buttonLabel="Edit | Details"
                          buttonClassName="!bg-white !text-red-600 !border !border-red-500 !shadow-none hover:!bg-red-50 dark:!bg-slate-950 dark:hover:!bg-rose-950/20"
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
