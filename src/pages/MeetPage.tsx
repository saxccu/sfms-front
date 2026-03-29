import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Calendar,
  Clock,
  Trash2,
  ExternalLink,
  Sparkles,
  Info
} from "lucide-react";
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Branch Meetings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
          Schedule and join secure video calls with your team.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Schedule Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-black text-slate-900 mb-6 dark:text-slate-50 flex items-center gap-2 uppercase tracking-widest">
              <Calendar className="h-5 w-5 text-emerald-primary" />
              Schedule New
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Meeting Title</label>
                <input
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Weekly Sync"
                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 font-bold shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 font-bold shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Duration (min)</label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 font-bold shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Room ID</label>
                  <div className="flex gap-2">
                    <input
                      value={draftRoom}
                      onChange={(e) => setDraftRoom(e.target.value)}
                      placeholder="Auto-gen"
                      className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-950 focus:border-emerald-primary focus:outline-none focus:ring-1 focus:ring-emerald-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 font-bold shadow-sm"
                    />
                    <button
                      onClick={generateRoom}
                      title="Generate ID"
                      className="rounded-2xl bg-slate-50 p-2.5 text-emerald-primary hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-400 transition-colors">
                      <Sparkles className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  onClick={saveMeeting}
                  disabled={savingMeeting || !meetingTitle || !scheduledAt}
                  className="w-full rounded-2xl bg-emerald-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-600 disabled:opacity-50 transition-all">
                  {savingMeeting ? "Scheduling..." : "Schedule Meeting"}
                </button>

                {meetingUrl && (
                  <button
                    onClick={() => setActiveRoom(safeDraftRoom)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/30 dark:text-rose-400 transition-all">
                    <Video className="h-5 w-5" />
                    Start Instant Call
                  </button>
                )}
              </div>

              {saveError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 font-bold">
                  <Info className="h-4 w-4" />
                  {saveError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming List */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 min-h-[400px]">
            <h2 className="text-lg font-black text-slate-900 mb-6 dark:text-slate-50 uppercase tracking-widest">Upcoming Calls</h2>

            {meetingsError && (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 font-bold mb-4">
                {meetingsError}
              </div>
            )}

            {loadingMeetings ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-primary border-t-transparent" />
                <p className="mt-4 text-sm font-bold text-slate-400">Fetching scheduled calls...</p>
              </div>
            ) : meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-slate-50 p-6 text-slate-200 dark:bg-slate-900">
                  <Video className="h-10 w-10" />
                </div>
                <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">No meetings scheduled</h3>
                <p className="mt-1 text-sm font-bold text-slate-400 max-w-xs">Your branch doesn't have any upcoming calls. Start one now!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-50 bg-white p-5 transition-all hover:border-emerald-100 hover:shadow-xl hover:shadow-emerald-50 dark:border-slate-900/50 dark:bg-slate-900/10">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-primary transition-colors">
                        <span className="text-[10px] font-black uppercase tracking-widest">{new Date(m.scheduled_at).toLocaleDateString(undefined, { month: 'short' })}</span>
                        <span className="text-xl font-black leading-none">{new Date(m.scheduled_at).getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">
                          {m.title || "Untitled Meeting"}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(m.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Video className="h-3.5 w-3.5" />
                            {m.duration_minutes} min
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-16 sm:ml-0">
                      <a
                        href={m.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-emerald-primary dark:hover:bg-slate-800 transition-colors"
                        title="External Link">
                        <ExternalLink className="h-5 w-5" />
                      </a>

                      <button
                        onClick={() => setActiveRoom(m.room_name)}
                        className="rounded-2xl bg-rose-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-100 dark:shadow-none hover:bg-rose-700 transition-all uppercase tracking-widest">
                        Join
                      </button>

                      <button
                        onClick={() => deleteMeeting(m.id)}
                        className="rounded-xl p-2.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
                        title="Cancel">
                        <Trash2 className="h-5 w-5" />
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
      <AnimatePresence>
        {activeRoom && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex flex-col bg-slate-950 p-4">
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-widest">
                <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                Live Session: {activeRoom}
              </h3>
              <button
                onClick={() => setActiveRoom(null)}
                className="rounded-2xl bg-white/10 px-6 py-2.5 text-xs font-black text-white hover:bg-rose-600 transition-all uppercase tracking-widest">
                End Connection
              </button>
            </div>
            <div className="mt-2 flex-1 rounded-[32px] overflow-hidden bg-black border border-white/5 shadow-2xl">
              <iframe
                key={activeMeetingUrl}
                src={activeMeetingUrl!}
                title="Jitsi Meeting"
                allow="camera; microphone; fullscreen; display-capture"
                className="w-full h-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
