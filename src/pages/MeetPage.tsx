import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'

type Meeting = {
  id: number
  title: string | null
  room_name: string
  meeting_url: string
  scheduled_at: string
  duration_minutes: number
  branch_id: number
  created_by: number
  created_at: string
}

export default function MeetPage() {
  const { user } = useAuth()
  const [room, setRoom] = useState('')
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null)
  const [generatedRoom, setGeneratedRoom] = useState<string | null>(null)
  const [scheduleRoom, setScheduleRoom] = useState('')
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('30')
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [meetingsError, setMeetingsError] = useState<string | null>(null)
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [savingMeeting, setSavingMeeting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const displayName = useMemo(() => {
    if (!user?.name) return 'SFMS User'
    return user.name
  }, [user?.name])

  const safeRoom = useMemo(() => {
    const x = (joinedRoom ?? '').trim()
    if (!x) return null
    return x.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  }, [joinedRoom])

  const safeGeneratedRoom = useMemo(() => {
    const x = (generatedRoom ?? '').trim()
    if (!x) return null
    return x.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  }, [generatedRoom])

  const safeScheduleRoom = useMemo(() => {
    const x = (scheduleRoom ?? '').trim()
    if (!x) return null
    return x.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  }, [scheduleRoom])

  const meetingUrl = useMemo(() => {
    if (!safeRoom) return null
    const base = 'https://meet.jit.si'
    const url = new URL(`${base}/${encodeURIComponent(safeRoom)}`)
    url.searchParams.set('config.prejoinPageEnabled', 'false')
    url.searchParams.set('userInfo.displayName', displayName)
    return url.toString()
  }, [safeRoom, displayName])

  const generatedMeetingUrl = useMemo(() => {
    if (!safeScheduleRoom) return null
    const base = 'https://meet.jit.si'
    const url = new URL(`${base}/${encodeURIComponent(safeScheduleRoom)}`)
    url.searchParams.set('config.prejoinPageEnabled', 'false')
    url.searchParams.set('userInfo.displayName', displayName)
    return url.toString()
  }, [safeScheduleRoom, displayName])

  const scheduledSummary = useMemo(() => {
    if (!scheduledAt) return null
    const d = new Date(scheduledAt)
    if (!Number.isFinite(d.getTime())) return null
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [scheduledAt])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadingMeetings(true)
      setMeetingsError(null)
      try {
        const rows = await apiFetch<Meeting[]>(`/meetings?upcoming_only=true&limit=100`, {}, { auth: true })
        if (!cancelled) setMeetings(rows)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!cancelled) setMeetingsError(msg)
      } finally {
        if (!cancelled) setLoadingMeetings(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function generateRoom() {
    const rand = Math.random().toString(36).slice(2, 8)
    const d = new Date()
    const y = String(d.getFullYear())
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const branch = user?.branch_id ? `b${user.branch_id}` : 'b'
    const next = `sfms-${branch}-${y}${m}${day}-${rand}`
    setGeneratedRoom(next)
    setScheduleRoom(next)
    setCopyStatus(null)
    setSaveError(null)
  }

  async function saveGeneratedMeeting() {
    if (!safeScheduleRoom || !generatedMeetingUrl) return

    if (!scheduledAt) {
      setSaveError('Please pick a date & time before saving.')
      return
    }

    const d = new Date(scheduledAt)
    if (!Number.isFinite(d.getTime())) {
      setSaveError('Invalid date & time.')
      return
    }

    const dur = Number(durationMinutes)
    if (!Number.isFinite(dur) || dur < 5) {
      setSaveError('Duration must be at least 5 minutes.')
      return
    }

    setSavingMeeting(true)
    setSaveError(null)
    try {
      const created = await apiFetch<Meeting>(
        `/meetings`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: meetingTitle.trim() ? meetingTitle.trim() : null,
            room_name: safeScheduleRoom,
            meeting_url: generatedMeetingUrl,
            scheduled_at: d.toISOString(),
            duration_minutes: dur,
          }),
        },
        { auth: true },
      )

      setMeetings((prev) => [created, ...prev].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(msg)
    } finally {
      setSavingMeeting(false)
    }
  }

  async function deleteMeeting(id: number) {
    try {
      await apiFetch<void>(`/meetings/${id}`, { method: 'DELETE' }, { auth: true })
      setMeetings((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMeetingsError(msg)
    }
  }

  async function copyLink() {
    if (!generatedMeetingUrl) return
    try {
      await navigator.clipboard.writeText(generatedMeetingUrl)
      setCopyStatus('Copied')
      window.setTimeout(() => setCopyStatus(null), 1500)
    } catch {
      setCopyStatus('Copy failed')
      window.setTimeout(() => setCopyStatus(null), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Video Meeting</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Powered by Jitsi (public server)</div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Schedule a meeting</div>
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">Generate a secure link to share before the meeting starts.</div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">Title</label>
              <input
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="e.g. Branch Weekly Meeting"
                className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">Meeting ID</label>
              <input
                value={scheduleRoom}
                onChange={(e) => setScheduleRoom(e.target.value)}
                placeholder="e.g. branch-weekly-2026"
                className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Allowed: letters, numbers, dash and underscore.</div>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">Date & time</label>
              <input
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                type="datetime-local"
                className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-1 sm:col-start-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">Duration (minutes)</label>
              <input
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                type="number"
                min={5}
                step={5}
                className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={generateRoom}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Generate link
            </button>

            {generatedMeetingUrl ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  <div className="flex flex-col gap-1">
                    <div className="truncate">
                      <span className="font-semibold">Meeting ID:</span> {safeScheduleRoom}
                    </div>
                    {meetingTitle.trim() ? (
                      <div className="truncate">
                        <span className="font-semibold">Title:</span> {meetingTitle.trim()}
                      </div>
                    ) : null}
                    {scheduledSummary ? (
                      <div className="truncate">
                        <span className="font-semibold">When:</span> {scheduledSummary}
                      </div>
                    ) : null}
                    {durationMinutes.trim() ? (
                      <div className="truncate">
                        <span className="font-semibold">Duration:</span> {durationMinutes.trim()} min
                      </div>
                    ) : null}
                    <div className="truncate">
                      <span className="font-semibold">Link:</span> {generatedMeetingUrl}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    {copyStatus ? copyStatus : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={saveGeneratedMeeting}
                    disabled={savingMeeting}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    {savingMeeting ? 'Saving…' : 'Save'}
                  </button>
                  <a
                    href={generatedMeetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (safeScheduleRoom) {
                        setRoom(safeScheduleRoom)
                        setJoinedRoom(safeScheduleRoom)
                      }
                    }}
                    className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Join
                  </button>
                </div>
              </div>
            ) : null}

            {saveError ? <div className="text-xs text-red-600">{saveError}</div> : null}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Upcoming meetings</div>
            <button
              type="button"
              onClick={() => {
                setLoadingMeetings(true)
                setMeetingsError(null)
                apiFetch<Meeting[]>(`/meetings?upcoming_only=true&limit=100`, {}, { auth: true })
                  .then((rows) => setMeetings(rows))
                  .catch((err) => {
                    const msg = err instanceof Error ? err.message : String(err)
                    setMeetingsError(msg)
                  })
                  .finally(() => setLoadingMeetings(false))
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Refresh
            </button>
          </div>

          {meetingsError ? <div className="mt-2 text-xs text-red-600">{meetingsError}</div> : null}

          {loadingMeetings ? (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">Loading…</div>
          ) : meetings.length === 0 ? (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">No upcoming meetings.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {meetings.map((m) => {
                const when = new Date(m.scheduled_at)
                const whenText = Number.isFinite(when.getTime())
                  ? when.toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : m.scheduled_at

                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {m.title ? m.title : 'Untitled meeting'}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">When:</span> {whenText} · <span className="font-semibold">Duration:</span>{' '}
                          {m.duration_minutes} min
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">ID:</span> {m.room_name}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(m.meeting_url)
                            } catch {
                              setMeetingsError('Copy failed')
                            }
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          Copy
                        </button>
                        <a
                          href={m.meeting_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          Open
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setRoom(m.room_name)
                            setJoinedRoom(m.room_name)
                          }}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Join
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMeeting(m.id)}
                          className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">Room name</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. Branch-Meeting"
              className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Letters, numbers, dash and underscore are recommended.</div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setJoinedRoom(room)}
              disabled={!room.trim()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Join
            </button>
            {safeRoom ? (
              <button
                type="button"
                onClick={() => setJoinedRoom(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Leave
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {meetingUrl ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <iframe
              key={meetingUrl}
              src={meetingUrl}
              title="Jitsi Meeting"
              allow="camera; microphone; fullscreen; display-capture"
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
