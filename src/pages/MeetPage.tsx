import { useEffect, useMemo, useState } from "react";
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
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMeeting(false);
    }
  }

  async function deleteMeeting(id: number) {
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
    <div className="space-y-6">
      {/* Schedule */}
      <div className="rounded-2xl border p-5 bg-white dark:bg-slate-950">
        <h2 className="text-sm font-semibold">Schedule Meeting</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Meeting title"
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            value={draftRoom}
            onChange={(e) => setDraftRoom(e.target.value)}
            placeholder="Meeting ID"
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            type="number"
            min={5}
            step={5}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={generateRoom}
            className="bg-slate-900 text-white px-4 py-2 rounded">
            Generate
          </button>

          <button
            onClick={saveMeeting}
            disabled={savingMeeting}
            className="border px-4 py-2 rounded">
            {savingMeeting ? "Saving..." : "Save"}
          </button>

          {meetingUrl && (
            <button
              onClick={() => setActiveRoom(safeDraftRoom)}
              className="bg-red-600 text-white px-4 py-2 rounded">
              Join
            </button>
          )}
        </div>

        {saveError && (
          <div className="text-red-600 text-xs mt-2">{saveError}</div>
        )}
      </div>

      {/* Upcoming */}
      <div className="rounded-2xl border p-5 bg-white dark:bg-slate-950">
        <h2 className="text-sm font-semibold">Upcoming Meetings</h2>
        <h2 className="text-sm font-semibold">Upcoming Meetings</h2>

        {meetingsError && (
          <div className="text-xs text-red-600 mt-2">{meetingsError}</div>
        )}

        {loadingMeetings ? (
          <div className="text-xs mt-2">Loading...</div>
        ) : meetings.length === 0 ? (
          <div className="text-xs mt-2">No meetings</div>
        ) : (
          <div className="mt-3 space-y-2">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="border rounded p-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">
                    {m.title || "Untitled"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(m.scheduled_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={m.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="border px-3 py-1 rounded text-xs">
                    Open
                  </a>

                  <button
                    onClick={() => setActiveRoom(m.room_name)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-xs">
                    Join
                  </button>

                  <button
                    onClick={() => deleteMeeting(m.id)}
                    className="border border-red-400 text-red-600 px-3 py-1 rounded text-xs">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Meeting */}
      {activeMeetingUrl && (
        <div className="rounded-2xl border p-3 bg-white dark:bg-slate-950">
          <iframe
            key={activeMeetingUrl}
            src={activeMeetingUrl}
            title="Jitsi Meeting"
            allow="camera; microphone; fullscreen"
            className="w-full h-[70vh] rounded"
          />
        </div>
      )}
    </div>
  );
}
