import { useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useWait } from '../context/WaitContext'
import { ApiError, apiFetch, apiFetchBlob, apiFetchForm } from '../lib/api'
import ActionDropdown, { type ActionDropdownItem } from '../components/ActionDropdown'

type BranchOut = {
  id: number
  name: string
  created_at: string
}

type RootFolderOut = {
  branch_id: number
  name: string
  relative_path: string
}

type FolderEntryOut = {
  name: string
  entry_type: 'folder' | 'file'
  relative_path: string
  size?: number | null
  file_type?: string | null
  member_id?: string | null
}

type FolderHasFilesOut = {
  has_files: boolean
}

type ClipboardState = {
  operation: 'copy' | 'move'
  entry_type: 'file' | 'folder'
  source_path: string
  source_name: string
} | null

type UserOut = {
  id: number
  name: string
  email: string
  role: string
  branch_id: number
}

type UserSearchOut = {
  id: number
  name: string
  email: string
  branch_id: number
  branch_name: string
}

export default function FileManagerPage() {
  const { user } = useAuth()
  const wait = useWait()
  const [q, setQ] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [branches, setBranches] = useState<BranchOut[]>([])
  const [branchId, setBranchId] = useState<number | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)

  const [rootFolders, setRootFolders] = useState<RootFolderOut[]>([])
  const [rootFoldersLoading, setRootFoldersLoading] = useState(false)
  const [rootFoldersError, setRootFoldersError] = useState<string | null>(null)

  const [currentFolder, setCurrentFolder] = useState<RootFolderOut | null>(null)
  const [folderEntries, setFolderEntries] = useState<FolderEntryOut[]>([])
  const [folderEntriesLoading, setFolderEntriesLoading] = useState(false)
  const [folderEntriesError, setFolderEntriesError] = useState<string | null>(null)

  const [folderHasFilesByPath, setFolderHasFilesByPath] = useState<Record<string, boolean>>({})

  const [clipboard, setClipboard] = useState<ClipboardState>(null)

  const [notice, setNotice] = useState<string | null>(null)

  const [shareOpen, setShareOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareLink, setShareLink] = useState('')
  const [shareRole, setShareRole] = useState<'READ_ONLY' | 'EDITOR'>('EDITOR')
  const [shareExpiresOn, setShareExpiresOn] = useState('')
  const [shareFilePath, setShareFilePath] = useState('')
  const [sharePeopleQuery, setSharePeopleQuery] = useState('')
  const [sharePeopleResults, setSharePeopleResults] = useState<UserSearchOut[]>([])
  const [sharePeopleLoading, setSharePeopleLoading] = useState(false)
  const [sharePeopleError, setSharePeopleError] = useState<string | null>(null)
  const [shareSelectedPeople, setShareSelectedPeople] = useState<UserSearchOut[]>([])
  const [sharePeopleDropdownOpen, setSharePeopleDropdownOpen] = useState(false)
  const sharePeopleBoxRef = useRef<HTMLDivElement | null>(null)

  const [createRootOpen, setCreateRootOpen] = useState(false)
  const [newRootFolderName, setNewRootFolderName] = useState('')
  const [createRootError, setCreateRootError] = useState<string | null>(null)
  const [createRootLoading, setCreateRootLoading] = useState(false)

  const [createSubOpen, setCreateSubOpen] = useState(false)
  const [newSubFolderName, setNewSubFolderName] = useState('')
  const [createSubError, setCreateSubError] = useState<string | null>(null)
  const [createSubLoading, setCreateSubLoading] = useState(false)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignFolder, setAssignFolder] = useState<RootFolderOut | null>(null)
  const [assignUsers, setAssignUsers] = useState<UserOut[]>([])
  const [assignUserId, setAssignUserId] = useState<number | ''>('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadDate, setUploadDate] = useState('')
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadAddMemberId, setUploadAddMemberId] = useState(false)
  const [uploadMemberId, setUploadMemberId] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isBranchManager = user?.role === 'BRANCH_MANAGER'
  const userId = user?.id ?? null
  const userBranchId = user?.branch_id ?? null

  const branchName = useMemo(() => {
    const b = branches.find((x) => x.id === branchId)
    return b?.name ?? ''
  }, [branches, branchId])

  useEffect(() => {
    let cancelled = false
    async function hydrateFolderHasFiles() {
      if (!branchId) return

      const paths = new Set<string>()
      for (const e of folderEntries) {
        if (e.entry_type === 'folder') paths.add(e.relative_path)
      }
      for (const r of rootFolders) {
        paths.add(r.relative_path)
      }

      const missing = Array.from(paths).filter((p) => folderHasFilesByPath[p] === undefined)
      if (missing.length === 0) return

      try {
        const results = await Promise.all(
          missing.map(async (p) => {
            const res = await apiFetch<FolderHasFilesOut>(
              `/files/folder-has-files?branch_id=${encodeURIComponent(String(branchId))}&relative_path=${encodeURIComponent(p)}`,
              { method: 'GET' },
              { auth: true },
            )
            return [p, res.has_files] as const
          }),
        )
        if (cancelled) return
        setFolderHasFilesByPath((prev) => {
          const next = { ...prev }
          for (const [p, has] of results) next[p] = has
          return next
        })
      } catch {
        // ignore
      }
    }

    hydrateFolderHasFiles()
    return () => {
      cancelled = true
    }
  }, [branchId, folderEntries, rootFolders, folderHasFilesByPath])

  useEffect(() => {
    let cancelled = false

    async function loadBranches() {
      setBranchError(null)
      try {
        const res = await apiFetch<BranchOut[]>('/branches', { method: 'GET' }, { auth: true })
        if (cancelled) return
        setBranches(res)
        const urlBranchIdRaw = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('branch_id') : null
        const urlBranchId = urlBranchIdRaw ? Number(urlBranchIdRaw) : null
        if (!isSuperAdmin && userBranchId != null) {
          setBranchId(userBranchId)
          return
        }
        if (urlBranchId != null && !Number.isNaN(urlBranchId) && res.some((b) => b.id === urlBranchId)) {
          setBranchId(urlBranchId)
          return
        }
        if (res.length > 0 && branchId == null) {
          setBranchId(res[0].id)
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) {
          setBranchError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
        } else {
          setBranchError('Failed to load branches')
        }
      }
    }

    loadBranches()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin, userBranchId])

  function isEditDisabledForFile(entry: FolderEntryOut): boolean {
    const t = (entry.file_type ?? '').toLowerCase()
    const n = entry.name.toLowerCase()
    if (t.startsWith('audio/')) return true
    if (t.startsWith('video/')) return true
    if (t === 'application/pdf' || n.endsWith('.pdf')) return true
    return false
  }

  function isOfficeFile(entry: FolderEntryOut): boolean {
    const ext = entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() ?? '' : ''
    return new Set(['docx', 'xlsx', 'xlsb', 'pptx', 'doc', 'xls', 'ppt']).has(ext)
  }

  function buildFolderContentsUrl(branchId: number, relativePath: string): string {
    const params = new URLSearchParams({
      branch_id: String(branchId),
      relative_path: relativePath,
    })
    if (fromDate.trim()) params.set('from_date', fromDate.trim())
    if (toDate.trim()) params.set('to_date', toDate.trim())
    return `/files/folder-contents?${params.toString()}`
  }

  function copyEntry(entry: FolderEntryOut) {
    setClipboard({ operation: 'copy', entry_type: entry.entry_type, source_path: entry.relative_path, source_name: entry.name })
    setNotice(`Copied: ${entry.name}`)
    setTimeout(() => setNotice(null), 2500)
  }

  function cutEntry(entry: FolderEntryOut) {
    setClipboard({ operation: 'move', entry_type: entry.entry_type, source_path: entry.relative_path, source_name: entry.name })
    setNotice(`Cut: ${entry.name}`)
    setTimeout(() => setNotice(null), 2500)
  }

  async function pasteInto(destinationFolderPath: string) {
    if (!clipboard) return

    setFolderEntriesError(null)
    wait.start(clipboard.operation === 'move' ? 'Moving items…' : 'Copying items…')
    try {
      await apiFetch<{ status: string; destination_path: string }>(
        '/files/paste',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: clipboard.operation,
            entry_type: clipboard.entry_type,
            source_path: clipboard.source_path,
            destination_folder_path: destinationFolderPath,
          }),
        },
        { auth: true },
      )

      if (clipboard.operation === 'move') setClipboard(null)

      if (branchId && currentFolder) {
        const refreshed = await apiFetch<FolderEntryOut[]>(
          buildFolderContentsUrl(branchId, currentFolder.relative_path),
          { method: 'GET' },
          { auth: true },
        )
        setFolderEntries(refreshed)
      } else if (branchId) {
        const refreshed = await apiFetch<RootFolderOut[]>(`/files/root-folders?branch_id=${encodeURIComponent(String(branchId))}`, { method: 'GET' }, { auth: true })
        setRootFolders(refreshed)
      }

      setNotice('Pasted successfully')
      setTimeout(() => setNotice(null), 2500)
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setFolderEntriesError('Failed to paste')
      }
    } finally {
      wait.stop()
    }
  }

  async function viewFile(entry: FolderEntryOut) {
    if (isOfficeFile(entry)) {
      wait.start('Opening file…')
      window.open(`/editor?file_path=${encodeURIComponent(entry.relative_path)}`, '_blank', 'noopener,noreferrer')
      wait.stop()
      return
    }
    wait.start('Opening file…')
    try {
      const blob = await apiFetchBlob(
        `/files/content?file_path=${encodeURIComponent(entry.relative_path)}`,
        { method: 'GET' },
        { auth: true },
      )
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setFolderEntriesError('Failed to view file')
      }
    } finally {
      wait.stop()
    }
  }

  async function submitCreateSubFolder() {
    const name = newSubFolderName.trim()
    if (!name) {
      setCreateSubError('Folder name is required')
      return
    }

    if (!branchId) {
      setCreateSubError('Select a branch first')
      return
    }

    if (!currentFolder) {
      setCreateSubError('Open a parent folder first')
      return
    }

    setCreateSubLoading(true)
    setCreateSubError(null)
    try {
      await apiFetch<{ branch_id: number; name: string; relative_path: string }>(
        '/files/subfolders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch_id: branchId, parent_relative_path: currentFolder.relative_path, name }),
        },
        { auth: true },
      )

      setCreateSubOpen(false)
      setNewSubFolderName('')

      const refreshed = await apiFetch<FolderEntryOut[]>(
        buildFolderContentsUrl(branchId, currentFolder.relative_path),
        { method: 'GET' },
        { auth: true },
      )
      setFolderEntries(refreshed)
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateSubError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setCreateSubError('Failed to create folder')
      }
    } finally {
      setCreateSubLoading(false)
    }
  }

  async function deleteEntry(entry: FolderEntryOut) {
    if (!(isSuperAdmin || isBranchManager)) return

    const ok = window.confirm(`Delete ${entry.entry_type === 'folder' ? 'folder' : 'file'} "${entry.name}"?`)
    if (!ok) return

    setFolderEntriesError(null)
    setNotice(null)
    try {
      if (entry.entry_type === 'folder') {
        if (!branchId) throw new Error('Missing branch')
        await apiFetch(
          `/files/folder?branch_id=${encodeURIComponent(String(branchId))}&relative_path=${encodeURIComponent(entry.relative_path)}`,
          { method: 'DELETE' },
          { auth: true },
        )
      } else {
        await apiFetch(
          `/files?file_path=${encodeURIComponent(entry.relative_path)}`,
          { method: 'DELETE' },
          { auth: true },
        )
      }

      if (branchId && currentFolder) {
        const refreshed = await apiFetch<FolderEntryOut[]>(
          buildFolderContentsUrl(branchId, currentFolder.relative_path),
          { method: 'GET' },
          { auth: true },
        )
        setFolderEntries(refreshed)
      } else if (branchId) {
        const refreshed = await apiFetch<RootFolderOut[]>(
          `/files/root-folders?branch_id=${encodeURIComponent(String(branchId))}`,
          { method: 'GET' },
          { auth: true },
        )
        setRootFolders(refreshed)
      }

      setNotice('Deleted successfully')
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setFolderEntriesError('Failed to delete')
      }
    }
  }

  async function downloadFile(entry: FolderEntryOut) {
    wait.start('Downloading file…')
    try {
      const blob = await apiFetchBlob(
        `/files/download?file_path=${encodeURIComponent(entry.relative_path)}`,
        { method: 'GET' },
        { auth: true },
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = entry.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setFolderEntriesError('Failed to download file')
      }
    } finally {
      wait.stop()
    }
  }

  async function editFile(entry: FolderEntryOut) {
    const disabled = isEditDisabledForFile(entry)
    if (disabled) return

    if (isOfficeFile(entry)) {
      window.open(`/editor?file_path=${encodeURIComponent(entry.relative_path)}`, '_blank', 'noopener,noreferrer')
      return
    }

    const newName = window.prompt('Rename file', entry.name)
    if (!newName) return

    try {
      await apiFetch(
        '/files/rename',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: entry.relative_path, new_name: newName }),
        },
        { auth: true },
      )

      if (branchId && currentFolder) {
        const refreshed = await apiFetch<FolderEntryOut[]>(
          buildFolderContentsUrl(branchId, currentFolder.relative_path),
          { method: 'GET' },
          { auth: true },
        )
        setFolderEntries(refreshed)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFolderEntriesError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setFolderEntriesError('Failed to edit file')
      }
    }
  }

  async function openShareDialog(entry: FolderEntryOut) {
    setShareError(null)
    setShareLink('')
    setShareFilePath(entry.relative_path)
    setSharePeopleQuery('')
    setSharePeopleResults([])
    setSharePeopleError(null)
    setShareSelectedPeople([])
    setSharePeopleDropdownOpen(false)
    setShareRole('EDITOR')
    setShareExpiresOn('')
    setShareOpen(true)
    setShareLoading(true)
    try {
      const res = await apiFetch<{ url: string }>(
        '/files/share-link',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: entry.relative_path }),
        },
        { auth: true },
      )

      const fullUrl = `${(import.meta as any).env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'}${res.url}`
      setShareLink(fullUrl)
    } catch (err) {
      if (err instanceof ApiError) {
        setShareError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setShareError('Failed to create share link')
      }
    } finally {
      setShareLoading(false)
    }
  }

  async function copyShareLink() {
    if (!shareLink) return
    await navigator.clipboard.writeText(shareLink)
    setNotice('Share link copied to clipboard')
    setTimeout(() => setNotice(null), 4000)
  }

  function closeShareDialog() {
    if (shareLoading) return
    setShareOpen(false)
  }

  async function submitShare() {
    if (!shareFilePath) {
      setShareError('Missing file')
      return
    }
    if (shareSelectedPeople.length === 0) {
      setShareError('Select at least one user')
      return
    }

    setShareLoading(true)
    setShareError(null)
    try {
      const expires_at = shareExpiresOn ? `${shareExpiresOn}T23:59:59Z` : null
      await apiFetch(
        '/files/shares',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_path: shareFilePath,
            user_ids: shareSelectedPeople.map((p) => p.id),
            role: shareRole,
            expires_at,
          }),
        },
        { auth: true },
      )

      setNotice('File shared successfully')
      setTimeout(() => setNotice(null), 4000)
      setShareOpen(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setShareError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setShareError('Failed to share file')
      }
    } finally {
      setShareLoading(false)
    }
  }

  useEffect(() => {
    if (!shareOpen) return

    const q = sharePeopleQuery.trim()
    if (q.length < 2) {
      setSharePeopleResults([])
      setSharePeopleDropdownOpen(false)
      setSharePeopleError(null)
      return
    }

    let cancelled = false
    setSharePeopleLoading(true)
    setSharePeopleError(null)

    const t = window.setTimeout(async () => {
      try {
        const res = await apiFetch<UserSearchOut[]>(`/users/search?q=${encodeURIComponent(q)}&limit=10`, { method: 'GET' }, { auth: true })
        if (cancelled) return
        const selectedIds = new Set(shareSelectedPeople.map((p) => p.id))
        setSharePeopleResults(res.filter((r) => !selectedIds.has(r.id)))
        setSharePeopleDropdownOpen(true)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) {
          setSharePeopleError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
        } else {
          setSharePeopleError('Failed to search users')
        }
        setSharePeopleResults([])
        setSharePeopleDropdownOpen(true)
      } finally {
        if (!cancelled) setSharePeopleLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [shareOpen, sharePeopleQuery, shareSelectedPeople])

  useEffect(() => {
    if (!shareOpen) return

    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node | null
      if (!t) return
      if (sharePeopleBoxRef.current?.contains(t)) return
      setSharePeopleDropdownOpen(false)
    }

    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [shareOpen])

  function addSharePerson(u: UserSearchOut) {
    setShareSelectedPeople((prev) => [...prev, u])
    setSharePeopleQuery('')
    setSharePeopleResults([])
    setSharePeopleDropdownOpen(false)
  }

  function removeSharePerson(id: number) {
    setShareSelectedPeople((prev) => prev.filter((p) => p.id !== id))
  }

  function openAssignDialog(folder: RootFolderOut) {
    setAssignError(null)
    setAssignFolder(folder)
    setAssignUserId('')
    setAssignOpen(true)
  }

  function closeAssignDialog() {
    if (assignLoading) return
    setAssignOpen(false)
    setAssignFolder(null)
  }

  useEffect(() => {
    let cancelled = false

    async function loadAssignableUsers() {
      if (!assignOpen) return
      if (!isBranchManager) return
      if (!branchId) return

      setAssignError(null)
      try {
        const res = await apiFetch<UserOut[]>('/users', { method: 'GET' }, { auth: true })
        if (cancelled) return
        setAssignUsers(res.filter((u) => u.branch_id === branchId && u.role !== 'SUPER_ADMIN' && u.id !== userId))
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) {
          setAssignError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
        } else {
          setAssignError('Failed to load users')
        }
      }
    }

    loadAssignableUsers()
    return () => {
      cancelled = true
    }
  }, [assignOpen, isBranchManager, branchId, userId])

  function openUploadDialog() {
    setUploadError(null)
    setUploadDate('')
    setUploadFileName('')
    setUploadFile(null)
    setUploadAddMemberId(false)
    setUploadMemberId('')
    setUploadOpen(true)
  }

  function closeUploadDialog() {
    if (uploadLoading) return
    setUploadOpen(false)
  }

  async function submitUpload() {
    const dateValue = uploadDate.trim()
    const baseName = uploadFileName.trim()
    const memberIdValue = uploadMemberId.trim()

    if (!dateValue) {
      setUploadError('Date is required')
      return
    }

    if (!baseName) {
      setUploadError('File name is required')
      return
    }

    if (!uploadFile) {
      setUploadError('Select a file to upload')
      return
    }

    if (uploadAddMemberId && !memberIdValue) {
      setUploadError('Member ID is required')
      return
    }

    let finalName = baseName
    const original = uploadFile.name
    const dotIdx = original.lastIndexOf('.')
    const originalExt = dotIdx >= 0 ? original.slice(dotIdx) : ''
    const nameHasExt = finalName.includes('.')
    if (!nameHasExt && originalExt) {
      finalName = `${finalName}${originalExt}`
    }

    const renamed = new File([uploadFile], finalName, { type: uploadFile.type })

    const form = new FormData()
    form.append('upload', renamed)
    form.append('document_date', dateValue)
    if (uploadAddMemberId && memberIdValue) {
      form.append('member_id', memberIdValue)
    }
    if (currentFolder) {
      form.append('parent_relative_path', currentFolder.relative_path)
    }

    setUploadLoading(true)
    setUploadError(null)
    wait.start('Uploading file…')
    try {
      await apiFetchForm('/files/upload', form)

      if (branchId && currentFolder) {
        try {
          const refreshed = await apiFetch<FolderEntryOut[]>(
            buildFolderContentsUrl(branchId, currentFolder.relative_path),
            { method: 'GET' },
            { auth: true },
          )
          setFolderEntries(refreshed)
        } catch {
          // ignore refresh failure; upload succeeded
        }
      }

      setUploadOpen(false)
      setUploadDate('')
      setUploadFileName('')
      setUploadFile(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setUploadError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setUploadError('Failed to upload file')
      }
    } finally {
      wait.stop()
      setUploadLoading(false)
    }
  }

  async function submitAssignFolder() {
    if (!assignFolder) return
    if (!branchId) {
      setAssignError('Select a branch first')
      return
    }

    if (assignUserId === '') {
      setAssignError('Select a user')
      return
    }

    setAssignLoading(true)
    setAssignError(null)
    try {
      await apiFetch(
        '/folder-assignments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: Number(assignUserId),
            branch_id: branchId,
            relative_path: assignFolder.relative_path,
          }),
        },
        { auth: true },
      )
      setAssignOpen(false)
      setAssignFolder(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setAssignError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setAssignError('Failed to assign folder')
      }
    } finally {
      setAssignLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadRootFolders() {
      if (!branchId) {
        setRootFolders([])
        setCurrentFolder(null)
        return
      }

      setRootFoldersLoading(true)
      setRootFoldersError(null)
      try {
        const res = await apiFetch<RootFolderOut[]>(
          `/files/root-folders?branch_id=${encodeURIComponent(String(branchId))}`,
          { method: 'GET' },
          { auth: true },
        )
        if (cancelled) return
        setRootFolders(res)
        setCurrentFolder(null)
        setFolderEntries([])
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) {
          setRootFoldersError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
        } else {
          setRootFoldersError('Failed to load folders')
        }
      } finally {
        if (!cancelled) setRootFoldersLoading(false)
      }
    }

    loadRootFolders()
    return () => {
      cancelled = true
    }
  }, [branchId])

  useEffect(() => {
    let cancelled = false

    async function loadFolderEntries() {
      if (!branchId) {
        setFolderEntries([])
        return
      }

      if (!currentFolder) {
        setFolderEntries([])
        return
      }

      setFolderEntriesLoading(true)
      setFolderEntriesError(null)
      try {
        const res = await apiFetch<FolderEntryOut[]>(
          buildFolderContentsUrl(branchId, currentFolder.relative_path),
          { method: 'GET' },
          { auth: true },
        )
        if (cancelled) return
        setFolderEntries(res)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) {
          setFolderEntriesError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
        } else {
          setFolderEntriesError('Failed to load folder contents')
        }
      } finally {
        if (!cancelled) setFolderEntriesLoading(false)
      }
    }

    loadFolderEntries()
    return () => {
      cancelled = true
    }
  }, [branchId, currentFolder?.relative_path, fromDate, toDate])

  function openFolder(folder: RootFolderOut) {
    setFolderEntriesError(null)
    setCurrentFolder(folder)
  }

  function goToRoot() {
    setFolderEntriesError(null)
    setCurrentFolder(null)
    setFolderEntries([])
  }

  function openCreateRootDialog() {
    setCreateRootError(null)
    setNewRootFolderName('')
    setCreateRootOpen(true)
  }

  function closeCreateRootDialog() {
    if (createRootLoading) return
    setCreateRootOpen(false)
  }

  function openCreateSubDialog() {
    setCreateSubError(null)
    setNewSubFolderName('')
    setCreateSubOpen(true)
  }

  function closeCreateSubDialog() {
    if (createSubLoading) return
    setCreateSubOpen(false)
  }

  async function submitCreateRootFolder() {
    const name = newRootFolderName.trim()
    if (!name) {
      setCreateRootError('Folder name is required')
      return
    }

    if (!branchId) {
      setCreateRootError('Select a branch first')
      return
    }

    setCreateRootLoading(true)
    setCreateRootError(null)
    try {
      await apiFetch<{ branch_id: number; name: string; relative_path: string }>(
        '/files/root-folders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch_id: branchId, name }),
        },
        { auth: true },
      )

      setCreateRootOpen(false)
      setNewRootFolderName('')
      const refreshed = await apiFetch<RootFolderOut[]>(
        `/files/root-folders?branch_id=${encodeURIComponent(String(branchId))}`,
        { method: 'GET' },
        { auth: true },
      )
      setRootFolders(refreshed)
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateRootError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setCreateRootError('Failed to create folder')
      }
    } finally {
      setCreateRootLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">File Manager</div>
          <div className="text-sm text-slate-500">Managing files for {branchName || '—'}</div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => setViewMode((v) => (v === 'list' ? 'grid' : 'list'))}
            className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'grid'
                ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900'
            }`}
            aria-label={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M4 4h7v7H4V4z" />
              <path d="M13 4h7v7h-7V4z" />
              <path d="M4 13h7v7H4v-7z" />
              <path d="M13 13h7v7h-7v-7z" />
            </svg>
          </button>
          {isSuperAdmin || isBranchManager ? (
            <button
              onClick={openCreateRootDialog}
              disabled={isBranchManager && !!currentFolder}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <span className="text-base leading-none">+</span>
              Create Parent Folder
            </button>
          ) : null}
          <button
            onClick={openUploadDialog}
            disabled={!currentFolder}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Upload
          </button>
          <button
            onClick={openCreateSubDialog}
            disabled={!branchId || !currentFolder}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <span className="text-base leading-none">+</span>
            New Folder
          </button>
        </div>
      </div>

      {branchError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{branchError}</div>
      ) : null}

      {rootFoldersError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{rootFoldersError}</div>
      ) : null}

      {folderEntriesError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{folderEntriesError}</div>
      ) : null}

      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-3xl">
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search files and folders..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setFromDate('')
              setToDate('')
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Clear
          </button>
        </div>

        <div className="w-full md:w-auto">
          <select
            value={branchId ?? ''}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
            disabled={!isSuperAdmin}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 md:min-w-56"
          >
            {branches.length === 0 ? <option value="">No branches</option> : null}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="M3 12l9-9 9 9" />
            <path d="M9 21V9h6v12" />
          </svg>
        </span>
        <button onClick={goToRoot} className="font-medium text-slate-900 hover:underline">
          {branchName || '—'}
        </button>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">{currentFolder ? currentFolder.name : '(Root)'}</span>
      </div>
      {viewMode === 'list' ? (
        <div className="sfms-listing-card rounded-md">
          <div className="overflow-auto">
            <table className="sfms-table">
              <thead className="sfms-thead">
                <tr>
                  <th className="sfms-th">Name</th>
                  <th className="sfms-th">Type</th>
                  <th className="sfms-th">Size</th>
                  <th className="sfms-th">Modified</th>
                  <th className="sfms-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rootFoldersLoading || folderEntriesLoading ? (
                  <tr>
                    <td className="sfms-td py-10 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={5}>
                      Loading…
                    </td>
                  </tr>
                ) : currentFolder ? (
                  folderEntries.length === 0 ? (
                    <tr>
                      <td className="sfms-td py-10 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={5}>
                        This folder is empty.
                      </td>
                    </tr>
                  ) : (
                    folderEntries
                      .filter((e) => {
                        const q2 = q.trim().toLowerCase()
                        if (!q2) return true
                        const nameOk = e.name.toLowerCase().includes(q2)
                        const memberOk = (e.member_id ?? '').toString().toLowerCase().includes(q2)
                        return nameOk || memberOk
                      })
                      .map((e) => (
                        <tr key={e.relative_path} className="sfms-tr">
                          <td className="sfms-td font-medium">{e.name}</td>
                          <td className="sfms-td text-slate-700 dark:text-slate-300">{e.entry_type === 'folder' ? 'Folder' : 'File'}</td>
                          <td className="sfms-td text-slate-700 dark:text-slate-300">{e.entry_type === 'file' ? String(e.size ?? '—') : '—'}</td>
                          <td className="sfms-td text-slate-700 dark:text-slate-300">—</td>
                          <td className="sfms-td text-right">
                            <ActionDropdown
                              items={
                                (e.entry_type === 'folder'
                                  ? ([
                                      {
                                        label: 'Open',
                                        onClick: () => openFolder({ branch_id: branchId ?? 0, name: e.name, relative_path: e.relative_path }),
                                      },
                                      { type: 'separator' },
                                      { label: 'Copy', onClick: () => copyEntry(e) },
                                      { label: 'Cut', onClick: () => cutEntry(e) },
                                      {
                                        label: 'Paste',
                                        disabled: !clipboard,
                                        onClick: () => void pasteInto(e.relative_path),
                                      },
                                      ...(isSuperAdmin || isBranchManager
                                        ? ([
                                            { type: 'separator' },
                                            {
                                              label: 'Delete',
                                              danger: true,
                                              disabled: folderHasFilesByPath[e.relative_path] === true,
                                              onClick: () => deleteEntry(e),
                                            },
                                          ] satisfies ActionDropdownItem[])
                                        : ([] satisfies ActionDropdownItem[])),
                                    ] satisfies ActionDropdownItem[])
                                  : ([
                                      { label: 'View', onClick: () => viewFile(e) },
                                      { label: 'Download', onClick: () => downloadFile(e) },
                                      { label: 'Edit', onClick: () => editFile(e), disabled: isEditDisabledForFile(e) },
                                      { label: 'Share', onClick: () => openShareDialog(e) },
                                      { type: 'separator' },
                                      { label: 'Copy', onClick: () => copyEntry(e) },
                                      { label: 'Cut', onClick: () => cutEntry(e) },
                                      ...(isSuperAdmin || isBranchManager
                                        ? ([
                                            { type: 'separator' },
                                            { label: 'Delete', danger: true, onClick: () => deleteEntry(e) },
                                          ] satisfies ActionDropdownItem[])
                                        : ([] satisfies ActionDropdownItem[])),
                                    ] satisfies ActionDropdownItem[])) as ActionDropdownItem[]
                              }
                            />
                          </td>
                        </tr>
                      ))
                  )
                ) : rootFolders.length === 0 ? (
                  <tr>
                    <td className="sfms-td py-10 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={5}>
                      No files or folders yet.
                    </td>
                  </tr>
                ) : (
                  rootFolders
                    .filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()))
                    .map((f) => (
                      <tr key={f.relative_path} className="sfms-tr">
                        <td className="sfms-td font-medium">{f.name}</td>
                        <td className="sfms-td text-slate-700 dark:text-slate-300">Folder</td>
                        <td className="sfms-td text-slate-700 dark:text-slate-300">—</td>
                        <td className="sfms-td text-slate-700 dark:text-slate-300">—</td>
                        <td className="sfms-td text-right">
                          <ActionDropdown
                            items={
                              ([
                                { label: 'Open', onClick: () => openFolder(f) },
                                { type: 'separator' },
                                { label: 'Copy', onClick: () => copyEntry({ name: f.name, entry_type: 'folder', relative_path: f.relative_path } as FolderEntryOut) },
                                { label: 'Cut', onClick: () => cutEntry({ name: f.name, entry_type: 'folder', relative_path: f.relative_path } as FolderEntryOut) },
                                {
                                  label: 'Paste',
                                  disabled: !clipboard,
                                  onClick: () => void pasteInto(f.relative_path),
                                },
                                ...(isBranchManager
                                  ? ([{ label: 'Assign folder', onClick: () => openAssignDialog(f) }] satisfies ActionDropdownItem[])
                                  : ([] satisfies ActionDropdownItem[])),
                                ...(isSuperAdmin || isBranchManager
                                  ? ([
                                      { type: 'separator' },
                                      {
                                        label: 'Delete',
                                        danger: true,
                                        disabled: folderHasFilesByPath[f.relative_path] === true,
                                        onClick: () =>
                                          deleteEntry({ name: f.name, entry_type: 'folder', relative_path: f.relative_path } as FolderEntryOut),
                                      },
                                    ] satisfies ActionDropdownItem[])
                                  : ([] satisfies ActionDropdownItem[])),
                              ] satisfies ActionDropdownItem[]) as ActionDropdownItem[]
                            }
                          />
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          {rootFoldersLoading || folderEntriesLoading ? (
            <div className="px-2 py-10 text-center text-sm text-slate-500">Loading…</div>
          ) : currentFolder ? (
            folderEntries.filter((e) => {
              const q2 = q.trim().toLowerCase()
              if (!q2) return true
              const nameOk = e.name.toLowerCase().includes(q2)
              const memberOk = (e.member_id ?? '').toString().toLowerCase().includes(q2)
              return nameOk || memberOk
            }).length === 0 ? (
              <div className="px-2 py-10 text-center text-sm text-slate-500">This folder is empty.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {folderEntries
                  .filter((e) => {
                    const q2 = q.trim().toLowerCase()
                    if (!q2) return true
                    const nameOk = e.name.toLowerCase().includes(q2)
                    const memberOk = (e.member_id ?? '').toString().toLowerCase().includes(q2)
                    return nameOk || memberOk
                  })
                  .map((e) => (
                    <div
                      key={e.relative_path}
                      className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            {e.entry_type === 'folder' ? '⌂' : '▦'}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{e.name}</div>
                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {e.entry_type === 'folder' ? 'Folder' : 'File'}
                              {e.entry_type === 'file' ? ` · ${String(e.size ?? '—')}` : ''}
                            </div>
                          </div>
                        </div>
                        <ActionDropdown
                          items={
                            (e.entry_type === 'folder'
                              ? ([
                                  {
                                    label: 'Open',
                                    onClick: () => openFolder({ branch_id: branchId ?? 0, name: e.name, relative_path: e.relative_path }),
                                  },
                                  { type: 'separator' },
                                  { label: 'Copy', onClick: () => copyEntry(e) },
                                  { label: 'Cut', onClick: () => cutEntry(e) },
                                  {
                                    label: 'Paste',
                                    disabled: !clipboard,
                                    onClick: () => void pasteInto(e.relative_path),
                                  },
                                  ...(isSuperAdmin || isBranchManager
                                    ? ([
                                        { type: 'separator' },
                                        {
                                          label: 'Delete',
                                          danger: true,
                                          disabled: folderHasFilesByPath[e.relative_path] === true,
                                          onClick: () => deleteEntry(e),
                                        },
                                      ] satisfies ActionDropdownItem[])
                                    : ([] satisfies ActionDropdownItem[])),
                                ] satisfies ActionDropdownItem[])
                              : ([
                                  { label: 'View', onClick: () => viewFile(e) },
                                  { label: 'Download', onClick: () => downloadFile(e) },
                                  { label: 'Edit', onClick: () => editFile(e), disabled: isEditDisabledForFile(e) },
                                  { label: 'Share', onClick: () => openShareDialog(e) },
                                  { type: 'separator' },
                                  { label: 'Copy', onClick: () => copyEntry(e) },
                                  { label: 'Cut', onClick: () => cutEntry(e) },
                                  ...(isSuperAdmin || isBranchManager
                                    ? ([
                                        { type: 'separator' },
                                        { label: 'Delete', danger: true, onClick: () => deleteEntry(e) },
                                      ] satisfies ActionDropdownItem[])
                                    : ([] satisfies ActionDropdownItem[])),
                                ] satisfies ActionDropdownItem[])) as ActionDropdownItem[]
                          }
                          buttonClassName="!px-2 !py-1.5 !rounded-xl"
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )
          ) : rootFolders.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())).length === 0 ? (
            <div className="px-2 py-10 text-center text-sm text-slate-500">No files or folders yet.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rootFolders
                .filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()))
                .map((f) => (
                  <div
                    key={f.relative_path}
                    className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          ⌂
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{f.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Folder</div>
                        </div>
                      </div>
                      <ActionDropdown
                        items={
                          ([
                            { label: 'Open', onClick: () => openFolder(f) },
                            { type: 'separator' },
                            { label: 'Copy', onClick: () => copyEntry({ name: f.name, entry_type: 'folder', relative_path: f.relative_path } as FolderEntryOut) },
                            { label: 'Cut', onClick: () => cutEntry({ name: f.name, entry_type: 'folder', relative_path: f.relative_path } as FolderEntryOut) },
                            {
                              label: 'Paste',
                              disabled: !clipboard,
                              onClick: () => void pasteInto(f.relative_path),
                            },
                            ...(isBranchManager
                              ? ([{ label: 'Assign folder', onClick: () => openAssignDialog(f) }] satisfies ActionDropdownItem[])
                              : ([] satisfies ActionDropdownItem[])),
                            ...(isSuperAdmin || isBranchManager
                              ? ([
                                  { type: 'separator' },
                                  {
                                    label: 'Delete',
                                    danger: true,
                                    disabled: folderHasFilesByPath[f.relative_path] === true,
                                    onClick: () =>
                                      deleteEntry({ name: f.name, entry_type: 'folder', relative_path: f.relative_path } as FolderEntryOut),
                                  },
                                ] satisfies ActionDropdownItem[])
                              : ([] satisfies ActionDropdownItem[])),
                          ] satisfies ActionDropdownItem[]) as ActionDropdownItem[]
                        }
                        buttonClassName="!px-2 !py-1.5 !rounded-xl"
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {createRootOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeCreateRootDialog} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create Parent Folder</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create a new folder in the branch root</div>
              </div>
              <button
                onClick={closeCreateRootDialog}
                disabled={createRootLoading}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Folder Name</div>
                <input
                  value={newRootFolderName}
                  onChange={(e) => setNewRootFolderName(e.target.value)}
                  placeholder="Documents"
                  disabled={createRootLoading}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              {createRootError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{createRootError}</div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeCreateRootDialog}
                disabled={createRootLoading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={submitCreateRootFolder}
                disabled={createRootLoading}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createRootLoading ? 'Creating…' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createSubOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeCreateSubDialog} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create Folder</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create a new folder inside the current folder</div>
              </div>
              <button
                onClick={closeCreateSubDialog}
                disabled={createSubLoading}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Folder Name</div>
                <input
                  value={newSubFolderName}
                  onChange={(e) => setNewSubFolderName(e.target.value)}
                  placeholder="Documents"
                  disabled={createSubLoading}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              {createSubError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{createSubError}</div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeCreateSubDialog}
                disabled={createSubLoading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={submitCreateSubFolder}
                disabled={createSubLoading}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createSubLoading ? 'Creating…' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeAssignDialog} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Assign Folder</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{assignFolder?.name ?? '—'}</div>
              </div>
              <button
                onClick={closeAssignDialog}
                disabled={assignLoading}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Select User</div>
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value ? Number(e.target.value) : '')}
                  disabled={assignLoading}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Select user</option>
                  {assignUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </label>

              {assignError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{assignError}</div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeAssignDialog}
                disabled={assignLoading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={submitAssignFolder}
                disabled={assignLoading}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assignLoading ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeUploadDialog} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upload File</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select a date and file name</div>
              </div>
              <button
                onClick={closeUploadDialog}
                disabled={uploadLoading}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Date</div>
                <input
                  type="date"
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                  disabled={uploadLoading}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">File Name</div>
                <input
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="receipt-001"
                  disabled={uploadLoading}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={uploadAddMemberId}
                  onChange={(e) => setUploadAddMemberId(e.target.checked)}
                  disabled={uploadLoading}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Add member ID</span>
              </label>

              {uploadAddMemberId ? (
                <label className="block">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Member ID</div>
                  <input
                    value={uploadMemberId}
                    onChange={(e) => setUploadMemberId(e.target.value)}
                    placeholder="MEM-001"
                    disabled={uploadLoading}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              ) : null}

              <label className="block">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Choose File</div>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  disabled={uploadLoading}
                  className="mt-1 block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100 dark:file:border-slate-800 dark:file:bg-slate-950 dark:file:text-slate-200 dark:hover:file:bg-slate-900"
                />
              </label>

              {uploadError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{uploadError}</div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeUploadDialog}
                disabled={uploadLoading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={submitUpload}
                disabled={uploadLoading}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadLoading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeShareDialog} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Share with others</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Get shareable link</div>
              </div>
              <button
                onClick={closeShareDialog}
                disabled={shareLoading}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Role</div>
                    <select
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value === 'READ_ONLY' ? 'READ_ONLY' : 'EDITOR')}
                      disabled={shareLoading}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="READ_ONLY">Read only</option>
                      <option value="EDITOR">Editor</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Expiration date</div>
                    <input
                      type="date"
                      value={shareExpiresOn}
                      onChange={(e) => setShareExpiresOn(e.target.value)}
                      disabled={shareLoading}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Shareable link</div>
                  <div className="mt-2 flex w-full items-center gap-2">
                    <input
                      value={shareLoading ? 'Generating…' : shareLink}
                      readOnly
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      onClick={() => void copyShareLink()}
                      disabled={shareLoading || !shareLink}
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">People</div>
                <div ref={sharePeopleBoxRef} className="relative mt-2">
                  <input
                    value={sharePeopleQuery}
                    onChange={(e) => setSharePeopleQuery(e.target.value)}
                    onFocus={() => {
                      if (sharePeopleResults.length > 0 || sharePeopleError) setSharePeopleDropdownOpen(true)
                    }}
                    placeholder="Search by user name..."
                    disabled={shareLoading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />

                  {sharePeopleDropdownOpen ? (
                    <div className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                      {sharePeopleLoading ? (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Searching…</div>
                      ) : sharePeopleError ? (
                        <div className="px-3 py-2 text-sm text-rose-700">{sharePeopleError}</div>
                      ) : sharePeopleResults.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches</div>
                      ) : (
                        sharePeopleResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => addSharePerson(u)}
                            className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{u.name}</div>
                              <div className="truncate text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                            </div>
                            <div className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">{u.branch_name}</div>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                {shareSelectedPeople.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {shareSelectedPeople.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {p.name}{' '}
                            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({p.branch_name})</span>
                          </div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">{p.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSharePerson(p.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Selecting people is UI-only for now; permissions aren’t stored yet.</div>
              </div>
            </div>

            {shareError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{shareError}</div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeShareDialog}
                disabled={shareLoading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitShare()}
                disabled={shareLoading || shareSelectedPeople.length === 0}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
