import { useEffect, useMemo, useState } from "react";
import {
  VideoCameraIcon,
  CalendarDaysIcon,
  ClockIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

type Meeting = {
  id: number;
  title: string | null;
  room_name: string;
  meeting_url: string;
  scheduled_at: string;
  duration_minutes: number;
  branch_id: number;
  created_by: number;
  created_at: string;
};

function sanitizeRoom(value?: string | null): string | null {
  const x = (value ?? "").trim();
  if (!x) return null;
  return x.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

export default function MeetPage() {
  usePageTitle("Meetings");
  const { user } = useAuth();

  // Scheduling state
  const [draftRoom, setDraftRoom] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");

  // Active meeting state
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  // UI state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const displayName = user?.name?.trim() || "SFMS User";

  const safeDraftRoom = useMemo(() => sanitizeRoom(draftRoom), [draftRoom]);

  const meetingUrl = useMemo(() => {
    if (!safeDraftRoom) return null;
    const url = new URL(
      `https://meet.jit.si/${encodeURIComponent(safeDraftRoom)}`,
    );
    url.searchParams.set("config.prejoinPageEnabled", "false");
    url.searchParams.set("userInfo.displayName", displayName);
    return url.toString();
  }, [safeDraftRoom, displayName]);

  const activeMeetingUrl = useMemo(() => {
    if (!activeRoom) return null;
    const url = new URL(
      `https://meet.jit.si/${encodeURIComponent(activeRoom)}`,
    );
    url.searchParams.set("config.prejoinPageEnabled", "false");
    url.searchParams.set("userInfo.displayName", displayName);
    return url.toString();
  }, [activeRoom, displayName]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingMeetings(true);
      setMeetingsError(null);
      try {
        const rows = await apiFetch<Meeting[]>(
          `/meetings?upcoming_only=true&limit=100`,
          {},
          { auth: true },
        );
        if (!cancelled) setMeetings(rows);
      } catch (err) {
        if (!cancelled)
          setMeetingsError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoadingMeetings(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function generateRoom() {
    const rand = Math.random().toString(36).slice(2, 8);
    const d = new Date();
    const branch = user?.branch_id ? `b${user.branch_id}` : "b";
    const id = `sfms-${branch}-${d.getFullYear()}${
      d.getMonth() + 1
    }${d.getDate()}-${rand}`;
    setDraftRoom(id);
  }

  async function saveMeeting() {
    if (!safeDraftRoom || !meetingUrl) return;

    const d = new Date(scheduledAt);
    const dur = Number(durationMinutes);

    if (!Number.isFinite(d.getTime())) {
      setSaveError("Invalid date & time.");
      return;
    }

    if (!Number.isFinite(dur) || dur < 5) {
      setSaveError("Duration must be at least 5 minutes.");
      return;
    }

    setSavingMeeting(true);
    setSaveError(null);

    try {
      const created = await apiFetch<Meeting>(
        `/meetings`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: meetingTitle.trim() || null,
            room_name: safeDraftRoom,
            meeting_url: meetingUrl,
            scheduled_at: d.toISOString(),
            duration_minutes: dur,
          }),
        },
        { auth: true },
      );

      setMeetings((prev) => [created, ...prev]);
      setMeetingTitle("");
      setDraftRoom("");
      setScheduledAt("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMeeting(false);
    }
  }

  async function deleteMeeting(id: number) {
    if (!window.confirm("Cancel this meeting?")) return;
    try {
      await apiFetch<void>(
        `/meetings/${id}`,
        { method: "DELETE" },
        { auth: true },
      );
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setMeetingsError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-sky-950 dark:text-sky-50">Branch Meetings</h1>
        <p className="text-sm text-sky-500 dark:text-sky-400">
          Schedule and join secure video calls with your team.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Schedule Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm dark:border-sky-800 dark:bg-sky-950">
            <h2 className="text-lg font-bold text-sky-950 mb-6 dark:text-sky-50 flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-primary-600" />
              Schedule New
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-sky-600 mb-1.5">Meeting Title</label>
                <input
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Weekly Sync"
                  className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-sm text-sky-950 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-sky-800 dark:bg-sky-900 dark:text-sky-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-sky-600 mb-1.5">Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-sm text-sky-950 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-sky-800 dark:bg-sky-900 dark:text-sky-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sky-600 mb-1.5">Duration (min)</label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-sm text-sky-950 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-sky-800 dark:bg-sky-900 dark:text-sky-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sky-600 mb-1.5">Room ID</label>
                  <div className="flex gap-2">
                    <input
                      value={draftRoom}
                      onChange={(e) => setDraftRoom(e.target.value)}
                      placeholder="Auto-gen"
                      className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-xs text-sky-950 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-sky-800 dark:bg-sky-900 dark:text-sky-50"
                    />
                    <button
                      onClick={generateRoom}
                      title="Generate ID"
                      className="rounded-2xl bg-sky-50 p-2.5 text-sky-600 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400">
                      <SparklesIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  onClick={saveMeeting}
                  disabled={savingMeeting || !meetingTitle || !scheduledAt}
                  className="w-full rounded-2xl bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-primary-700 disabled:opacity-50 transition-all">
                  {savingMeeting ? "Scheduling..." : "Schedule Meeting"}
                </button>

                {meetingUrl && (
                  <button
                    onClick={() => setActiveRoom(safeDraftRoom)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800 hover:bg-brand-100 dark:border-brand-600/35 dark:bg-brand-950/40 dark:text-brand-300 transition-all">
                    <VideoCameraIcon className="h-5 w-5" />
                    Start Instant Call
                  </button>
                )}
              </div>

              {saveError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/35 dark:text-rose-300">
                  <InformationCircleIcon className="h-4 w-4" />
                  {saveError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming List */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm dark:border-sky-800 dark:bg-sky-950 min-h-[400px]">
            <h2 className="text-lg font-bold text-sky-950 mb-6 dark:text-sky-50">Upcoming</h2>

            {meetingsError && (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/35 dark:text-rose-300 mb-4">
                {meetingsError}
              </div>
            )}

            {loadingMeetings ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                <p className="mt-4 text-sm text-sky-500">Fetching scheduled calls...</p>
              </div>
            ) : meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-sky-50 p-6 text-sky-400 dark:bg-sky-900/30">
                  <VideoCameraIcon className="h-10 w-10" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-sky-950 dark:text-sky-50">No meetings scheduled</h3>
                <p className="mt-1 text-sm text-sky-500 max-w-xs">Your branch doesn't have any upcoming calls. Start one now!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-sky-50 bg-white p-4 transition-all hover:border-primary-100 hover:shadow-sm dark:border-sky-900/50 dark:bg-sky-900/10">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-900 dark:text-sky-400">
                        <span className="text-[10px] font-bold uppercase">{new Date(m.scheduled_at).toLocaleDateString(undefined, { month: 'short' })}</span>
                        <span className="text-lg font-bold leading-none">{new Date(m.scheduled_at).getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-bold text-sky-950 dark:text-sky-50">
                          {m.title || "Untitled Meeting"}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-500">
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {new Date(m.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <VideoCameraIcon className="h-3.5 w-3.5" />
                            {m.duration_minutes} min
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-14 sm:ml-0">
                      <a
                        href={m.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl p-2 text-sky-400 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-800"
                        title="External Link">
                        <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                      </a>

                      <button
                        onClick={() => setActiveRoom(m.room_name)}
                        className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700 transition-all">
                        Join Call
                      </button>

                      <button
                        onClick={() => deleteMeeting(m.id)}
                        className="rounded-xl p-2 text-sky-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 transition-all"
                        title="Cancel">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Meeting Modal-ish */}
      {activeRoom && (
        <div className="fixed inset-0 z-50 flex flex-col bg-sky-950 p-4">
          <div className="flex items-center justify-between px-4 py-2">
            <h3 className="font-bold text-white flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
              Live Meeting: {activeRoom}
            </h3>
            <button
              onClick={() => setActiveRoom(null)}
              className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">
              End Connection
            </button>
          </div>
          <div className="mt-4 flex-1 rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl">
            <iframe
              key={activeMeetingUrl}
              src={activeMeetingUrl!}
              title="Jitsi Meeting"
              allow="camera; microphone; fullscreen; display-capture"
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
