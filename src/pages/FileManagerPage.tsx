import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  File as FileIcon,
  Search,
  Plus,
  Upload,
  Grid,
  List,
  Calendar,
  ChevronRight,
  Home,
  MoreVertical,
  Download,
  Share2,
  Edit3,
  Trash2,
  ExternalLink,
  Filter,
  X,
  Users,
  Clock,
  Link,
  Copy,
  UserPlus
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useWait } from "../context/WaitContext";
import { ApiError, apiFetch, apiFetchBlob, apiFetchForm } from "../lib/api";
import ActionDropdown, {
  type ActionDropdownItem,
} from "../components/ActionDropdown";

import { usePageTitle } from "../hooks/usePageTitle";

type BranchOut = {
  id: number;
  name: string;
  created_at: string;
};

type RootFolderOut = {
  branch_id: number;
  name: string;
  relative_path: string;
};

type FolderEntryOut = {
  name: string;
  entry_type: "folder" | "file";
  relative_path: string;
  size?: number | null;
  file_type?: string | null;
  member_id?: string | null;
};

type FolderHasFilesOut = {
  has_files: boolean;
};

type ClipboardState = {
  operation: "copy" | "move";
  entry_type: "file" | "folder";
  source_path: string;
  source_name: string;
} | null;

type UserOut = {
  id: number;
  name: string;
  email: string;
  role: string;
  branch_id: number;
};

type UserSearchOut = {
  id: number;
  name: string;
  email: string;
  branch_id: number;
  branch_name: string;
};

export default function FileManagerPage() {
  usePageTitle("File Manager");
  const { user } = useAuth();
  const wait = useWait();
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);

  const [rootFolders, setRootFolders] = useState<RootFolderOut[]>([]);
  const [rootFoldersLoading, setRootFoldersLoading] = useState(false);
  const [rootFoldersError, setRootFoldersError] = useState<string | null>(null);

  const [currentFolder, setCurrentFolder] = useState<RootFolderOut | null>(
    null,
  );
  const [folderEntries, setFolderEntries] = useState<FolderEntryOut[]>([]);
  const [folderEntriesLoading, setFolderEntriesLoading] = useState(false);
  const [folderEntriesError, setFolderEntriesError] = useState<string | null>(
    null,
  );

  const [folderHasFilesByPath, setFolderHasFilesByPath] = useState<
    Record<string, boolean>
  >({});

  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [shareRole, setShareRole] = useState<"READ_ONLY" | "EDITOR">("EDITOR");
  const [shareExpiresOn, setShareExpiresOn] = useState("");
  const [shareFilePath, setShareFilePath] = useState("");
  const [sharePeopleQuery, setSharePeopleQuery] = useState("");
  const [sharePeopleResults, setSharePeopleResults] = useState<UserSearchOut[]>(
    [],
  );
  const [sharePeopleLoading, setSharePeopleLoading] = useState(false);
  const [sharePeopleError, setSharePeopleError] = useState<string | null>(null);
  const [shareSelectedPeople, setShareSelectedPeople] = useState<
    UserSearchOut[]
  >([]);
  const [sharePeopleDropdownOpen, setSharePeopleDropdownOpen] = useState(false);
  const sharePeopleBoxRef = useRef<HTMLDivElement | null>(null);

  const [createRootOpen, setCreateRootOpen] = useState(false);
  const [newRootFolderName, setNewRootFolderName] = useState("");
  const [createRootError, setCreateRootError] = useState<string | null>(null);
  const [createRootLoading, setCreateRootLoading] = useState(false);

  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [newSubFolderName, setNewSubFolderName] = useState("");
  const [createSubError, setCreateSubError] = useState<string | null>(null);
  const [createSubLoading, setCreateSubLoading] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFolder, setAssignFolder] = useState<RootFolderOut | null>(null);
  const [assignUsers, setAssignUsers] = useState<UserOut[]>([]);
  const [assignUserId, setAssignUserId] = useState<number | "">("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDate, setUploadDate] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAddMemberId, setUploadAddMemberId] = useState(false);
  const [uploadMemberId, setUploadMemberId] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isBranchManager = user?.role === "BRANCH_MANAGER";
  const userId = user?.id ?? null;
  const userBranchId = user?.branch_id ?? null;

  const branchName = useMemo(() => {
    const b = branches.find((x) => x.id === branchId);
    return b?.name ?? "";
  }, [branches, branchId]);

  useEffect(() => {
    let cancelled = false;
    async function hydrateFolderHasFiles() {
      if (!branchId) return;

      const paths = new Set<string>();
      for (const e of folderEntries) {
        if (e.entry_type === "folder") paths.add(e.relative_path);
      }
      for (const r of rootFolders) {
        paths.add(r.relative_path);
      }

      const missing = Array.from(paths).filter(
        (p) => folderHasFilesByPath[p] === undefined,
      );
      if (missing.length === 0) return;

      try {
        const results = await Promise.all(
          missing.map(async (p) => {
            const res = await apiFetch<FolderHasFilesOut>(
              `/files/folder-has-files?branch_id=${encodeURIComponent(String(branchId))}&relative_path=${encodeURIComponent(p)}`,
              { method: "GET" },
              { auth: true },
            );
            return [p, res.has_files] as const;
          }),
        );
        if (cancelled) return;
        setFolderHasFilesByPath((prev) => {
          const next = { ...prev };
          for (const [p, has] of results) next[p] = has;
          return next;
        });
      } catch {
        // ignore
      }
    }

    hydrateFolderHasFiles();
    return () => {
      cancelled = true;
    };
  }, [branchId, folderEntries, rootFolders, folderHasFilesByPath]);

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      setBranchError(null);
      try {
        const res = await apiFetch<BranchOut[]>(
          "/branches",
          { method: "GET" },
          { auth: true },
        );
        if (cancelled) return;
        setBranches(res);
        const urlBranchIdRaw =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("branch_id")
            : null;
        const urlBranchId = urlBranchIdRaw ? Number(urlBranchIdRaw) : null;
        if (!isSuperAdmin && userBranchId != null) {
          setBranchId(userBranchId);
          return;
        }
        if (
          urlBranchId != null &&
          !Number.isNaN(urlBranchId) &&
          res.some((b) => b.id === urlBranchId)
        ) {
          setBranchId(urlBranchId);
          return;
        }
        if (res.length > 0 && branchId == null) {
          setBranchId(res[0].id);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setBranchError(
            `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
          );
        } else {
          setBranchError("Failed to load branches");
        }
      }
    }

    loadBranches();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, userBranchId]);

  function isEditDisabledForFile(entry: FolderEntryOut): boolean {
    const t = (entry.file_type ?? "").toLowerCase();
    const n = entry.name.toLowerCase();
    if (t.startsWith("audio/")) return true;
    if (t.startsWith("video/")) return true;
    if (t === "application/pdf" || n.endsWith(".pdf")) return true;
    return false;
  }

  function isOfficeFile(entry: FolderEntryOut): boolean {
    const ext = entry.name.includes(".")
      ? (entry.name.split(".").pop()?.toLowerCase() ?? "")
      : "";
    return new Set(["docx", "xlsx", "xlsb", "pptx", "doc", "xls", "ppt"]).has(
      ext,
    );
  }

  function buildFolderContentsUrl(
    branchId: number,
    relativePath: string,
  ): string {
    const params = new URLSearchParams({
      branch_id: String(branchId),
      relative_path: relativePath,
    });
    if (fromDate.trim()) params.set("from_date", fromDate.trim());
    if (toDate.trim()) params.set("to_date", toDate.trim());
    return `/files/folder-contents?${params.toString()}`;
  }

  function copyEntry(entry: FolderEntryOut) {
    setClipboard({
      operation: "copy",
      entry_type: entry.entry_type,
      source_path: entry.relative_path,
      source_name: entry.name,
    });
    setNotice(`Copied: ${entry.name}`);
    setTimeout(() => setNotice(null), 2500);
  }

  function cutEntry(entry: FolderEntryOut) {
    setClipboard({
      operation: "move",
      entry_type: entry.entry_type,
      source_path: entry.relative_path,
      source_name: entry.name,
    });
    setNotice(`Cut: ${entry.name}`);
    setTimeout(() => setNotice(null), 2500);
  }

  async function pasteInto(destinationFolderPath: string) {
    if (!clipboard) return;

    setFolderEntriesError(null);
    wait.start(
      clipboard.operation === "move" ? "Moving items…" : "Copying items…",
    );
    try {
      await apiFetch<{ status: string; destination_path: string }>(
        "/files/paste",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: clipboard.operation,
            entry_type: clipboard.entry_type,
            source_path: clipboard.source_path,
            destination_folder_path: destinationFolderPath,
          }),
        },
        { auth: true },
      );

      if (clipboard.operation === "move") setClipboard(null);

      if (branchId && currentFolder) {
        const refreshed = await apiFetch<FolderEntryOut[]>(
          buildFolderContentsUrl(branchId, currentFolder.relative_path),
          { method: "GET" },
          { auth: true },
        );
        setFolderEntries(refreshed);
      } else if (branchId) {
        const refreshed = await apiFetch<RootFolderOut[]>(
          `/files/root-folders?branch_id=${encodeURIComponent(String(branchId))}`,
          { method: "GET" },
          { auth: true },
        );
        setRootFolders(refreshed);
      }

      setNotice("Pasted successfully");
      setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setFolderEntriesError("Failed to paste");
      }
    } finally {
      wait.stop();
    }
  }

  async function viewFile(entry: FolderEntryOut) {
    if (isOfficeFile(entry)) {
      wait.start("Opening file…");
      window.open(
        `/editor?file_path=${encodeURIComponent(entry.relative_path)}`,
        "_blank",
        "noopener,noreferrer",
      );
      wait.stop();
      return;
    }
    wait.start("Opening file…");
    try {
      const blob = await apiFetchBlob(
        `/files/content?file_path=${encodeURIComponent(entry.relative_path)}`,
        { method: "GET" },
        { auth: true },
      );
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setFolderEntriesError("Failed to view file");
      }
    } finally {
      wait.stop();
    }
  }

  async function submitCreateSubFolder() {
    const name = newSubFolderName.trim();
    if (!name) {
      setCreateSubError("Folder name is required");
      return;
    }

    if (!branchId) {
      setCreateSubError("Select a branch first");
      return;
    }

    if (!currentFolder) {
      setCreateSubError("Open a parent folder first");
      return;
    }

    setCreateSubLoading(true);
    setCreateSubError(null);
    try {
      await apiFetch<{
        branch_id: number;
        name: string;
        relative_path: string;
      }>(
        "/files/subfolders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch_id: branchId,
            parent_relative_path: currentFolder.relative_path,
            name,
          }),
        },
        { auth: true },
      );

      setCreateSubOpen(false);
      setNewSubFolderName("");

      const refreshed = await apiFetch<FolderEntryOut[]>(
        buildFolderContentsUrl(branchId, currentFolder.relative_path),
        { method: "GET" },
        { auth: true },
      );
      setFolderEntries(refreshed);
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateSubError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setCreateSubError("Failed to create folder");
      }
    } finally {
      setCreateSubLoading(false);
    }
  }

  async function deleteEntry(entry: FolderEntryOut) {
    if (!(isSuperAdmin || isBranchManager)) return;

    const ok = window.confirm(
      `Delete ${entry.entry_type === "folder" ? "folder" : "file"} "${entry.name}"?`,
    );
    if (!ok) return;

    setFolderEntriesError(null);
    setNotice(null);
    try {
      if (entry.entry_type === "folder") {
        if (!branchId) throw new Error("Missing branch");
        await apiFetch(
          `/files/folder?branch_id=${encodeURIComponent(String(branchId))}&relative_path=${encodeURIComponent(entry.relative_path)}`,
          { method: "DELETE" },
          { auth: true },
        );
      } else {
        await apiFetch(
          `/files?file_path=${encodeURIComponent(entry.relative_path)}`,
          { method: "DELETE" },
          { auth: true },
        );
      }

      if (branchId && currentFolder) {
        const refreshed = await apiFetch<FolderEntryOut[]>(
          buildFolderContentsUrl(branchId, currentFolder.relative_path),
          { method: "GET" },
          { auth: true },
        );
        setFolderEntries(refreshed);
      } else if (branchId) {
        const refreshed = await apiFetch<RootFolderOut[]>(
          `/files/root-folders?branch_id=${encodeURIComponent(String(branchId))}`,
          { method: "GET" },
          { auth: true },
        );
        setRootFolders(refreshed);
      }

      setNotice("Deleted successfully");
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setFolderEntriesError("Failed to delete");
      }
    }
  }

  async function downloadFile(entry: FolderEntryOut) {
    wait.start("Downloading file…");
    try {
      const blob = await apiFetchBlob(
        `/files/download?file_path=${encodeURIComponent(entry.relative_path)}`,
        { method: "GET" },
        { auth: true },
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setFolderEntriesError("Failed to download file");
      }
    } finally {
      wait.stop();
    }
  }

  async function editFile(entry: FolderEntryOut) {
    const disabled = isEditDisabledForFile(entry);
    if (disabled) return;

    if (isOfficeFile(entry)) {
      window.open(
        `/editor?file_path=${encodeURIComponent(entry.relative_path)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    const newName = window.prompt("Rename file", entry.name);
    if (!newName) return;

    try {
      await apiFetch(
        "/files/rename",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_path: entry.relative_path,
            new_name: newName,
          }),
        },
        { auth: true },
      );

      if (branchId && currentFolder) {
        const refreshed = await apiFetch<FolderEntryOut[]>(
          buildFolderContentsUrl(branchId, currentFolder.relative_path),
          { method: "GET" },
          { auth: true },
        );
        setFolderEntries(refreshed);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setFolderEntriesError("Failed to edit file");
      }
    }
  }

  async function openShareDialog(entry: FolderEntryOut) {
    setShareError(null);
    setShareLink("");
    setShareFilePath(entry.relative_path);
    setSharePeopleQuery("");
    setSharePeopleResults([]);
    setSharePeopleError(null);
    setShareSelectedPeople([]);
    setSharePeopleDropdownOpen(false);
    setShareRole("EDITOR");
    setShareExpiresOn("");
    setShareOpen(true);
    setShareLoading(true);
    try {
      const res = await apiFetch<{ url: string }>(
        "/files/share-link",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: entry.relative_path }),
        },
        { auth: true },
      );

      const fullUrl = `${(import.meta as any).env?.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"}${res.url}`;
      setShareLink(fullUrl);
    } catch (err) {
      if (err instanceof ApiError) {
        setShareError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setShareError("Failed to create share link");
      }
    } finally {
      setShareLoading(false);
    }
  }

  async function copyShareLink() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setNotice("Share link copied to clipboard");
    setTimeout(() => setNotice(null), 4000);
  }


  async function submitShare() {
    if (!shareFilePath) {
      setShareError("Missing file");
      return;
    }
    if (shareSelectedPeople.length === 0) {
      setShareError("Select at least one user");
      return;
    }

    setShareLoading(true);
    setShareError(null);
    try {
      const expires_at = shareExpiresOn ? `${shareExpiresOn}T23:59:59Z` : null;
      await apiFetch(
        "/files/shares",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_path: shareFilePath,
            user_ids: shareSelectedPeople.map((p) => p.id),
            role: shareRole,
            expires_at,
          }),
        },
        { auth: true },
      );

      setNotice("File shared successfully");
      setTimeout(() => setNotice(null), 4000);
      setShareOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setShareError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setShareError("Failed to share file");
      }
    } finally {
      setShareLoading(false);
    }
  }

  useEffect(() => {
    if (!shareOpen) return;

    const q = sharePeopleQuery.trim();
    if (q.length < 2) {
      setSharePeopleResults([]);
      setSharePeopleDropdownOpen(false);
      setSharePeopleError(null);
      return;
    }

    let cancelled = false;
    setSharePeopleLoading(true);
    setSharePeopleError(null);

    const t = window.setTimeout(async () => {
      try {
        const res = await apiFetch<UserSearchOut[]>(
          `/users/search?q=${encodeURIComponent(q)}&limit=10`,
          { method: "GET" },
          { auth: true },
        );
        if (cancelled) return;
        const selectedIds = new Set(shareSelectedPeople.map((p) => p.id));
        setSharePeopleResults(res.filter((r) => !selectedIds.has(r.id)));
        setSharePeopleDropdownOpen(true);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setSharePeopleError(
            `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
          );
        } else {
          setSharePeopleError("Failed to search users");
        }
        setSharePeopleResults([]);
        setSharePeopleDropdownOpen(true);
      } finally {
        if (!cancelled) setSharePeopleLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [shareOpen, sharePeopleQuery, shareSelectedPeople]);

  useEffect(() => {
    if (!shareOpen) return;

    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (sharePeopleBoxRef.current?.contains(t)) return;
      setSharePeopleDropdownOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [shareOpen]);

  function addSharePerson(u: UserSearchOut) {
    setShareSelectedPeople((prev) => [...prev, u]);
    setSharePeopleQuery("");
    setSharePeopleResults([]);
    setSharePeopleDropdownOpen(false);
  }

  function removeSharePerson(id: number) {
    setShareSelectedPeople((prev) => prev.filter((p) => p.id !== id));
  }

  function openAssignDialog(folder: RootFolderOut) {
    setAssignError(null);
    setAssignFolder(folder);
    setAssignUserId("");
    setAssignOpen(true);
  }


  useEffect(() => {
    let cancelled = false;

    async function loadAssignableUsers() {
      if (!assignOpen) return;
      if (!isBranchManager) return;
      if (!branchId) return;

      setAssignError(null);
      try {
        const res = await apiFetch<UserOut[]>(
          "/users",
          { method: "GET" },
          { auth: true },
        );
        if (cancelled) return;
        setAssignUsers(
          res.filter(
            (u) =>
              u.branch_id === branchId &&
              u.role !== "SUPER_ADMIN" &&
              u.id !== userId,
          ),
        );
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setAssignError(
            `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
          );
        } else {
          setAssignError("Failed to load users");
        }
      }
    }

    loadAssignableUsers();
    return () => {
      cancelled = true;
    };
  }, [assignOpen, isBranchManager, branchId, userId]);

  function openUploadDialog() {
    setUploadError(null);
    setUploadDate("");
    setUploadFileName("");
    setUploadFile(null);
    setUploadAddMemberId(false);
    setUploadMemberId("");
    setUploadOpen(true);
  }


  async function submitUpload() {
    const dateValue = uploadDate.trim();
    const baseName = uploadFileName.trim();
    const memberIdValue = uploadMemberId.trim();

    if (!dateValue) {
      setUploadError("Date is required");
      return;
    }

    if (!baseName) {
      setUploadError("File name is required");
      return;
    }

    if (!uploadFile) {
      setUploadError("Select a file to upload");
      return;
    }

    if (uploadAddMemberId && !memberIdValue) {
      setUploadError("Member ID is required");
      return;
    }

    let finalName = baseName;
    const original = uploadFile.name;
    const dotIdx = original.lastIndexOf(".");
    const originalExt = dotIdx >= 0 ? original.slice(dotIdx) : "";
    const nameHasExt = finalName.includes(".");
    if (!nameHasExt && originalExt) {
      finalName = `${finalName}${originalExt}`;
    }

    const renamed = new File([uploadFile], finalName, {
      type: uploadFile.type,
    });

    const form = new FormData();
    form.append("upload", renamed);
    form.append("document_date", dateValue);
    if (uploadAddMemberId && memberIdValue) {
      form.append("member_id", memberIdValue);
    }
    if (currentFolder) {
      form.append("parent_relative_path", currentFolder.relative_path);
    }

    setUploadLoading(true);
    setUploadError(null);
    wait.start("Uploading file…");
    try {
      await apiFetchForm("/files/upload", form);

      if (branchId && currentFolder) {
        try {
          const refreshed = await apiFetch<FolderEntryOut[]>(
            buildFolderContentsUrl(branchId, currentFolder.relative_path),
            { method: "GET" },
            { auth: true },
          );
          setFolderEntries(refreshed);
        } catch {
          // ignore refresh failure; upload succeeded
        }
      }

      setUploadOpen(false);
      setUploadDate("");
      setUploadFileName("");
      setUploadFile(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setUploadError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setUploadError("Failed to upload file");
      }
    } finally {
      wait.stop();
      setUploadLoading(false);
    }
  }

  async function submitAssignFolder() {
    if (!assignFolder) return;
    if (!branchId) {
      setAssignError("Select a branch first");
      return;
    }

    if (assignUserId === "") {
      setAssignError("Select a user");
      return;
    }

    setAssignLoading(true);
    setAssignError(null);
    try {
      await apiFetch(
        "/folder-assignments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: Number(assignUserId),
            branch_id: branchId,
            relative_path: assignFolder.relative_path,
          }),
        },
        { auth: true },
      );
      setAssignOpen(false);
      setAssignFolder(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setAssignError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setAssignError("Failed to assign folder");
      }
    } finally {
      setAssignLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRootFolders() {
      if (!branchId) {
        setRootFolders([]);
        setCurrentFolder(null);
        return;
      }

      setRootFoldersLoading(true);
      setRootFoldersError(null);
      try {
        const res = await apiFetch<RootFolderOut[]>(
          `/files/root-folders?branch_id=${encodeURIComponent(String(branchId))}`,
          { method: "GET" },
          { auth: true },
        );
        if (cancelled) return;
        setRootFolders(res);
        setCurrentFolder(null);
        setFolderEntries([]);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setRootFoldersError(
            `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
          );
        } else {
          setRootFoldersError("Failed to load folders");
        }
      } finally {
        if (!cancelled) setRootFoldersLoading(false);
      }
    }

    loadRootFolders();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  useEffect(() => {
    let cancelled = false;

    async function loadFolderEntries() {
      if (!branchId) {
        setFolderEntries([]);
        return;
      }

      if (!currentFolder) {
        setFolderEntries([]);
        return;
      }

      setFolderEntriesLoading(true);
      setFolderEntriesError(null);
      try {
        const res = await apiFetch<FolderEntryOut[]>(
          buildFolderContentsUrl(branchId, currentFolder.relative_path),
          { method: "GET" },
          { auth: true },
        );
        if (cancelled) return;
        setFolderEntries(res);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setFolderEntriesError(
            `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
          );
        } else {
          setFolderEntriesError("Failed to load folder contents");
        }
      } finally {
        if (!cancelled) setFolderEntriesLoading(false);
      }
    }

    loadFolderEntries();
    return () => {
      cancelled = true;
    };
  }, [branchId, currentFolder?.relative_path, fromDate, toDate]);

  function openFolder(folder: RootFolderOut) {
    setFolderEntriesError(null);
    setCurrentFolder(folder);
  }

  function goToRoot() {
    setFolderEntriesError(null);
    setCurrentFolder(null);
    setFolderEntries([]);
  }

  function openCreateRootDialog() {
    setCreateRootError(null);
    setNewRootFolderName("");
    setCreateRootOpen(true);
  }


  function openCreateSubDialog() {
    setCreateSubError(null);
    setNewSubFolderName("");
    setCreateSubOpen(true);
  }


  async function submitCreateRootFolder() {
    const name = newRootFolderName.trim();
    if (!name) {
      setCreateRootError("Folder name is required");
      return;
    }

    if (!branchId) {
      setCreateRootError("Select a branch first");
      return;
    }

    setCreateRootLoading(true);
    setCreateRootError(null);
    try {
      await apiFetch<{
        branch_id: number;
        name: string;
        relative_path: string;
      }>(
        "/files/root-folders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branch_id: branchId, name }),
        },
        { auth: true },
      );

      setCreateRootOpen(false);
      setNewRootFolderName("");
      const refreshed = await apiFetch<RootFolderOut[]>(
        `/files/root-folders?branch_id=${encodeURIComponent(String(branchId))}`,
        { method: "GET" },
        { auth: true },
      );
      setRootFolders(refreshed);
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateRootError(
          `${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`,
        );
      } else {
        setCreateRootError("Failed to create folder");
      }
    } finally {
      setCreateRootLoading(false);
    }
  }

  function fmtSize(bytes?: number | null): string {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
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

  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase();
    const source = currentFolder ? folderEntries : rootFolders.map(f => ({ ...f, entry_type: "folder" } as FolderEntryOut));

    return source.filter((e) => {
      if (!query) return true;
      const nameOk = e.name.toLowerCase().includes(query);
      const memberOk = (e.member_id ?? "").toString().toLowerCase().includes(query);
      return nameOk || memberOk;
    });
  }, [q, currentFolder, folderEntries, rootFolders]);

  const getEntryActions = (e: FolderEntryOut): ActionDropdownItem[] => {
    if (e.entry_type === "folder") {
      return [
        {
          label: "Open",
          icon: ExternalLink,
          onClick: () => openFolder({
            branch_id: branchId ?? 0,
            name: e.name,
            relative_path: e.relative_path,
          }),
        },
        { type: "separator" },
        { label: "Copy", icon: Copy, onClick: () => copyEntry(e) },
        { label: "Cut", icon: Edit3, onClick: () => cutEntry(e) },
        {
          label: "Paste",
          icon: Plus,
          disabled: !clipboard,
          onClick: () => void pasteInto(e.relative_path),
        },
        ...(isBranchManager && !currentFolder ? [
          {
            label: "Assign folder",
            icon: UserPlus,
            onClick: () => openAssignDialog({
              branch_id: branchId ?? 0,
              name: e.name,
              relative_path: e.relative_path,
            }),
          },
        ] : []) as ActionDropdownItem[],
        ...(isSuperAdmin || isBranchManager ? [
          { type: "separator" },
          {
            label: "Delete",
            icon: Trash2,
            danger: true,
            disabled: folderHasFilesByPath[e.relative_path] === true,
            onClick: () => deleteEntry(e),
          },
        ] : []) as ActionDropdownItem[]
      ];
    } else {
      return [
        { label: "View", icon: ExternalLink, onClick: () => viewFile(e) },
        { label: "Download", icon: Download, onClick: () => downloadFile(e) },
        {
          label: "Edit",
          icon: Edit3,
          onClick: () => editFile(e),
          disabled: isEditDisabledForFile(e),
        },
        { label: "Share", icon: Share2, onClick: () => openShareDialog(e) },
        { type: "separator" },
        { label: "Copy", icon: Share2, onClick: () => copyEntry(e) },
        { label: "Cut", icon: Edit3, onClick: () => cutEntry(e) },
        ...(isSuperAdmin || isBranchManager ? [
          { type: "separator" },
          { label: "Delete", icon: Trash2, danger: true, onClick: () => deleteEntry(e) },
        ] : []) as ActionDropdownItem[]
      ];
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 max-w-2xl relative group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-primary transition-colors" size={20} />
           <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search in current directory..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-primary/10 transition-all outline-none shadow-sm"
           />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
           <button
             onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
             className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
           >
             {viewMode === 'grid' ? <List size={20} /> : <Grid size={20} />}
           </button>

           <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

           {isSuperAdmin || isBranchManager ? (
            <button
              onClick={openCreateRootDialog}
              disabled={isBranchManager && !!currentFolder}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              <Plus size={18} />
              <span>Parent Folder</span>
            </button>
           ) : null}

           <button
             onClick={openCreateSubDialog}
             disabled={!branchId || !currentFolder}
             className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
           >
             <Folder size={18} />
             <span>Sub-Folder</span>
           </button>

           <button
             onClick={openUploadDialog}
             disabled={!currentFolder}
             className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-primary text-white font-bold text-sm shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition-all disabled:opacity-50"
           >
             <Upload size={18} />
             <span>Upload File</span>
           </button>
        </div>
      </div>

      {/* Breadcrumbs & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-1">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
           <button
            onClick={goToRoot}
            className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-emerald-primary transition-colors whitespace-nowrap"
           >
             <Home size={18} />
             <span>{branchName || "Root"}</span>
           </button>

           <AnimatePresence mode="popLayout">
            {currentFolder && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3"
              >
                <ChevronRight size={16} className="text-slate-300" />
                <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-sm font-bold rounded-lg whitespace-nowrap">
                   {currentFolder.name}
                </div>
              </motion.div>
            )}
           </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 shadow-sm">
               <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 w-28"
               />
               <span className="text-slate-300 mx-1">/</span>
               <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 w-28"
               />
               {(fromDate || toDate) && (
                 <button onClick={() => {setFromDate(""); setToDate("")}} className="ml-1 p-1 hover:bg-slate-100 rounded-md">
                   <X size={12} />
                 </button>
               )}
            </div>

            <select
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
              disabled={!isSuperAdmin}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-emerald-primary disabled:opacity-50 transition-all shadow-sm"
            >
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
        </div>
      </div>

      {/* Errors & Notices */}
      <AnimatePresence>
        {(branchError || rootFoldersError || folderEntriesError) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-4 text-sm text-rose-800 dark:text-rose-300">
            {branchError || rootFoldersError || folderEntriesError}
          </motion.div>
        )}
        {notice && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-slate-900 text-white px-6 py-4 shadow-2xl flex items-center gap-4">
            <span className="text-sm font-bold">{notice}</span>
            <div className="h-5 w-[1px] bg-slate-700" />
            <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Listing */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-8">
          {rootFoldersLoading || folderEntriesLoading ? (
            Array(8).fill(0).map((_, i) => (
              <div key={i} className="h-48 rounded-3xl bg-slate-100 dark:bg-slate-900/50 animate-pulse" />
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-32 text-center">
               <div className="flex justify-center mb-6">
                 <div className="p-6 rounded-full bg-slate-50 dark:bg-slate-900">
                    <Folder className="text-slate-200" size={64} />
                 </div>
               </div>
               <h3 className="text-xl font-bold text-slate-900 dark:text-white">Directory is empty</h3>
               <p className="text-slate-500 mt-2">Try changing your filters or upload a new file.</p>
            </div>
          ) : (
            filteredItems.map((e) => (
              <motion.div
                key={e.relative_path}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative h-48 rounded-3xl glass-effect p-6 transition-all hover:shadow-xl hover:shadow-emerald-100/50 dark:hover:shadow-none hover:-translate-y-1"
              >
                <div className="flex items-start justify-between">
                   <div className={`p-4 rounded-2xl ${e.entry_type === 'folder' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/50' : 'bg-blue-50 text-blue-500 dark:bg-blue-950/50'}`}>
                      {e.entry_type === 'folder' ? <Folder size={28} /> : <FileIcon size={28} />}
                   </div>
                   <ActionDropdown
                     items={getEntryActions(e)}
                     buttonLabel={<MoreVertical size={18} className="text-slate-400" />}
                     buttonClassName="!bg-transparent !p-1 !shadow-none hover:!bg-slate-100 dark:hover:!bg-slate-800 !rounded-xl !text-inherit"
                   />
                </div>

                <div className="mt-6">
                   <div
                    onClick={() => e.entry_type === 'folder' && openFolder({ branch_id: branchId ?? 0, name: e.name, relative_path: e.relative_path })}
                    className="text-lg font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-emerald- primary transition-colors"
                    title={e.name}
                   >
                     {e.name}
                   </div>
                   <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <span>{e.entry_type === 'folder' ? 'Folder' : 'File'}</span>
                      {e.size && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>{fmtSize(e.size)}</span>
                        </>
                      )}
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-3xl glass-effect overflow-hidden">
           <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                   <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Name</th>
                   <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                   <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Size</th>
                   <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((e) => (
                  <tr key={e.relative_path} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors group">
                     <td className="px-8 py-4">
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => e.entry_type === 'folder' && openFolder({ branch_id: branchId ?? 0, name: e.name, relative_path: e.relative_path })}>
                           <div className={`p-2 rounded-xl ${e.entry_type === 'folder' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'} dark:bg-slate-800`}>
                              {e.entry_type === 'folder' ? <Folder size={18} /> : <FileIcon size={18} />}
                           </div>
                           <span className="font-bold text-slate-900 dark:text-white">{e.name}</span>
                        </div>
                     </td>
                     <td className="px-8 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {e.entry_type === 'folder' ? 'Folder' : 'File'}
                     </td>
                     <td className="px-8 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                        {fmtSize(e.size)}
                     </td>
                     <td className="px-8 py-4 text-right">
                        <ActionDropdown
                          items={getEntryActions(e)}
                          buttonLabel={<MoreVertical size={16} className="text-slate-400" />}
                          buttonClassName="!bg-transparent !p-1.5 !shadow-none hover:!bg-white dark:hover:!bg-slate-800 !rounded-xl !text-inherit"
                        />
                     </td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      )}

      {/* Modals - Simplified for aesthetic consistency */}
      <AnimatePresence>
        {(createRootOpen || createSubOpen || uploadOpen || assignOpen || shareOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
               onClick={() => {
                 setCreateRootOpen(false);
                 setCreateSubOpen(false);
                 setUploadOpen(false);
                 setAssignOpen(false);
                 setShareOpen(false);
               }}
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-lg bg-white dark:bg-slate-950 rounded-4xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto"
             >
                {createRootOpen && (
                  <>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Create Parent Folder</h2>
                    <p className="text-slate-500 font-medium mb-8">Add a new main category to this branch</p>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Folder Name</label>
                          <input
                            value={newRootFolderName}
                            onChange={(e) => setNewRootFolderName(e.target.value)}
                            placeholder="e.g. Marketing Projects"
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none font-bold"
                          />
                       </div>
                       {createRootError && <p className="text-rose-500 text-sm font-bold">{createRootError}</p>}
                       <button
                        onClick={submitCreateRootFolder}
                        disabled={createRootLoading}
                        className="w-full py-4 bg-emerald-primary text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition-all disabled:opacity-50"
                       >
                         {createRootLoading ? "Creating..." : "Confirm & Create"}
                       </button>
                    </div>
                  </>
                )}

                {createSubOpen && (
                   <>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">New Sub-Folder</h2>
                    <p className="text-slate-500 font-medium mb-8">Creating inside: {currentFolder?.name}</p>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Folder Name</label>
                          <input
                            value={newSubFolderName}
                            onChange={(e) => setNewSubFolderName(e.target.value)}
                            placeholder="e.g. Q4 Invoices"
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none font-bold"
                          />
                       </div>
                       {createSubError && <p className="text-rose-500 text-sm font-bold">{createSubError}</p>}
                       <button
                        onClick={submitCreateSubFolder}
                        disabled={createSubLoading}
                        className="w-full py-4 bg-emerald-primary text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition-all disabled:opacity-50"
                       >
                         {createSubLoading ? "Creating..." : "Confirm & Create"}
                       </button>
                    </div>
                  </>
                )}

                {uploadOpen && (
                  <>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Upload Asset</h2>
                    <p className="text-slate-500 font-medium mb-8">Select file and metadata to upload</p>
                    <div className="space-y-6">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Document Date</label>
                             <div className="relative">
                               <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                               <input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none text-sm font-bold" />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Friendly Name</label>
                             <input value={uploadFileName} onChange={(e) => setUploadFileName(e.target.value)} placeholder="File alias..." className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none text-sm font-bold" />
                          </div>
                       </div>

                       <div className="space-y-4">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${uploadAddMemberId ? 'bg-emerald-primary border-emerald-primary' : 'bg-slate-50 border-slate-200'}`}>
                               {uploadAddMemberId && <Plus size={14} className="text-white" />}
                            </div>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={uploadAddMemberId}
                              onChange={(e) => setUploadAddMemberId(e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Attach Member ID</span>
                          </label>

                          <AnimatePresence>
                            {uploadAddMemberId && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <input
                                  value={uploadMemberId}
                                  onChange={(e) => setUploadMemberId(e.target.value)}
                                  placeholder="Enter Member ID..."
                                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none text-sm font-bold"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                       </div>

                       <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-3 hover:border-emerald-primary/50 transition-colors group cursor-pointer relative">
                          <Upload className="text-slate-300 group-hover:text-emerald-primary transition-colors" size={32} />
                          <p className="text-sm font-bold text-slate-500 group-hover:text-slate-700 text-center">{uploadFile ? uploadFile.name : "Click to select or drag & drop"}</p>
                          <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                       </div>

                       {uploadError && <p className="text-rose-500 text-sm font-bold">{uploadError}</p>}
                       <button
                        onClick={submitUpload}
                        disabled={uploadLoading}
                        className="w-full py-4 bg-emerald-primary text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition-all disabled:opacity-50"
                       >
                         {uploadLoading ? "Uploading..." : "Start Upload"}
                       </button>
                    </div>
                  </>
                )}

                {assignOpen && (
                   <>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Assign Folder</h2>
                    <p className="text-slate-500 font-medium mb-8">Set owner for: {assignFolder?.name}</p>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Select User</label>
                          <div className="relative">
                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                              value={assignUserId}
                              onChange={(e) => setAssignUserId(e.target.value ? Number(e.target.value) : "")}
                              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none font-bold text-sm appearance-none"
                            >
                              <option value="">Choose a user...</option>
                              {assignUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.email})
                                </option>
                              ))}
                            </select>
                          </div>
                       </div>
                       {assignError && <p className="text-rose-500 text-sm font-bold">{assignError}</p>}
                       <button
                        onClick={submitAssignFolder}
                        disabled={assignLoading || assignUserId === ""}
                        className="w-full py-4 bg-emerald-primary text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition-all disabled:opacity-50"
                       >
                         {assignLoading ? "Assigning..." : "Assign Owner"}
                       </button>
                    </div>
                  </>
                )}

                {shareOpen && (
                   <div className="max-w-xl">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Share Asset</h2>
                    <p className="text-slate-500 font-medium mb-8">Manage access and share links</p>

                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Shareable Link</label>
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <Link className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input
                                readOnly
                                value={shareLoading ? "Generating..." : shareLink}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm font-bold text-slate-500"
                              />
                            </div>
                            <button
                              onClick={copyShareLink}
                              disabled={shareLoading || !shareLink}
                              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-emerald-primary hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                            >
                              <Copy size={20} />
                            </button>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Role</label>
                             <select
                                value={shareRole}
                                onChange={(e) => setShareRole(e.target.value as any)}
                                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none text-sm font-bold"
                             >
                                <option value="READ_ONLY">Viewer</option>
                                <option value="EDITOR">Editor</option>
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Expires On</label>
                             <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input type="date" value={shareExpiresOn} onChange={(e) => setShareExpiresOn(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none text-sm font-bold" />
                             </div>
                          </div>
                       </div>

                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Add People</label>
                          <div ref={sharePeopleBoxRef} className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                              value={sharePeopleQuery}
                              onChange={(e) => setSharePeopleQuery(e.target.value)}
                              onFocus={() => sharePeopleResults.length > 0 && setSharePeopleDropdownOpen(true)}
                              placeholder="Search by name or email..."
                              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-primary/20 outline-none font-bold text-sm"
                            />

                            <AnimatePresence>
                              {sharePeopleDropdownOpen && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 shadow-2xl">
                                   {sharePeopleLoading ? (
                                     <div className="p-4 text-center text-sm font-bold text-slate-400">Searching...</div>
                                   ) : sharePeopleError ? (
                                      <div className="p-4 text-center text-sm font-bold text-rose-500">{sharePeopleError}</div>
                                   ) : sharePeopleResults.length === 0 ? (
                                     <div className="p-4 text-center text-sm font-bold text-slate-400">No users found</div>
                                   ) : (
                                     sharePeopleResults.map((u) => (
                                       <button key={u.id} onClick={() => addSharePerson(u)} className="flex items-center justify-between w-full p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left group">
                                          <div>
                                            <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                                            <div className="text-xs text-slate-500">{u.email}</div>
                                          </div>
                                          <Plus size={18} className="text-slate-300 group-hover:text-emerald-primary transition-colors" />
                                       </button>
                                     ))
                                   )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                       </div>

                       {shareSelectedPeople.length > 0 && (
                         <div className="flex flex-wrap gap-2">
                            {shareSelectedPeople.map((p) => (
                              <div key={p.id} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold">
                                 <span>{p.name}</span>
                                 <button onClick={() => removeSharePerson(p.id)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-md transition-colors"><X size={12} /></button>
                              </div>
                            ))}
                         </div>
                       )}

                       {shareError && <p className="text-rose-500 text-sm font-bold">{shareError}</p>}
                       <button
                        onClick={submitShare}
                        disabled={shareLoading || shareSelectedPeople.length === 0}
                        className="w-full py-4 bg-emerald-primary text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition-all disabled:opacity-50"
                       >
                         {shareLoading ? "Sharing..." : "Share with Selected"}
                       </button>
                    </div>
                  </div>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
