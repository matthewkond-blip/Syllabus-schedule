import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import Header from "./components/Header";
import FileUpload from "./components/FileUpload";
import LoadingState from "./components/LoadingState";
import EventPreview from "./components/EventPreview";
import EventEditor from "./components/EventEditor";
import SyncSummary from "./components/SyncSummary";
import UploadErrorCard from "./components/UploadErrorCard";
import {
  disconnectGoogle,
  getGoogleStatus,
  listCalendars,
  startGoogleConnect,
  syncEventsToCalendar,
  uploadSyllabus,
} from "./services/api";

const STORAGE_KEY = "syllabussync:v1";
const CALENDAR_KEY = "syllabussync:calendarId";
// Groq's free tier has a small tokens-per-minute budget and a single syllabus
// can use most of it, so syllabi are processed one at a time.
const MAX_CONCURRENT_UPLOADS = 1;

const OAUTH_NOTICES = {
  connected: { kind: "success", text: "Google Calendar connected. Pick a calendar below, then add your events." },
  denied: { kind: "error", text: "Google sign-in was cancelled, so nothing was connected." },
  error: { kind: "error", text: "Connecting Google Calendar failed. Please try again." },
  "not-configured": {
    kind: "error",
    text: "Google Calendar isn't configured on the server yet. Add your OAuth credentials to backend/.env.",
  },
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota) — the app still works, it
    // just won't remember events across reloads.
  }
}

// Only fields the backend needs; keeps local-only state (selected, synced,
// courseId...) out of the request.
function toSyncPayload(event) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    course: event.course || "",
    date: event.date,
    time: event.allDay ? null : event.time || null,
    allDay: Boolean(event.allDay),
    description: event.description || null,
    sourceExcerpt: event.sourceExcerpt || null,
    reminderMinutes: Number(event.reminderMinutes) || 0,
  };
}

function App() {
  const [courses, setCourses] = useState(() => readStorage(STORAGE_KEY, {}).courses || []);
  const [events, setEvents] = useState(() => readStorage(STORAGE_KEY, {}).events || []);
  const [editingEvent, setEditingEvent] = useState(null);
  const [googleStatus, setGoogleStatus] = useState({ configured: false, connected: false });
  const [calendars, setCalendars] = useState([]);
  const [calendarId, setCalendarId] = useState(() => readStorage(CALENDAR_KEY, "primary"));
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  // OAuth finishes by redirecting back here with ?google=<outcome>.
  const [notice, setNotice] = useState(
    () => OAUTH_NOTICES[new URLSearchParams(window.location.search).get("google")] || null
  );

  const uploadQueueRef = useRef([]);
  const activeUploadsRef = useRef(0);
  const removedCourseIdsRef = useRef(new Set());
  const syncingRef = useRef(false);

  // Persist finished courses so events survive a refresh and the Google
  // OAuth redirect. In-flight uploads can't be resumed, so they're skipped.
  useEffect(() => {
    const readyCourses = courses
      .filter((c) => c.status === "ready")
      .map(({ file: _file, ...rest }) => rest);
    const readyIds = new Set(readyCourses.map((c) => c.id));
    writeStorage(STORAGE_KEY, {
      courses: readyCourses,
      events: events.filter((e) => readyIds.has(e.courseId)),
    });
  }, [courses, events]);

  useEffect(() => {
    writeStorage(CALENDAR_KEY, calendarId);
  }, [calendarId]);

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);

    getGoogleStatus()
      .then(setGoogleStatus)
      .catch(() => setGoogleStatus({ configured: false, connected: false }));
  }, []);

  useEffect(() => {
    if (!googleStatus.connected) return;
    listCalendars()
      .then(({ calendars: list }) => {
        setCalendars(list);
        setCalendarId((current) => {
          if (list.some((c) => c.id === current)) return current;
          return list.find((c) => c.primary)?.id || list[0]?.id || "primary";
        });
      })
      .catch((err) => {
        if (err.status === 401) setGoogleStatus((s) => ({ ...s, connected: false }));
        setNotice({ kind: "error", text: err.message });
      });
  }, [googleStatus.connected]);

  // --- Uploads -------------------------------------------------------------

  function updateCourse(id, changes) {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }

  async function processCourse(id, file) {
    updateCourse(id, { status: "processing", error: null });
    try {
      const result = await uploadSyllabus(file);
      if (removedCourseIdsRef.current.has(id)) return;
      updateCourse(id, { status: "ready", file: undefined, ...result.course });
      setEvents((prev) => [...prev, ...result.events.map((e) => ({ ...e, courseId: id }))]);
    } catch (err) {
      if (removedCourseIdsRef.current.has(id)) return;
      updateCourse(id, {
        status: "error",
        error: err.message || "Something went wrong while processing this syllabus.",
      });
    }
  }

  function pumpUploadQueue() {
    while (activeUploadsRef.current < MAX_CONCURRENT_UPLOADS && uploadQueueRef.current.length > 0) {
      const { id, file } = uploadQueueRef.current.shift();
      if (removedCourseIdsRef.current.has(id)) continue;
      activeUploadsRef.current += 1;
      processCourse(id, file).finally(() => {
        activeUploadsRef.current -= 1;
        pumpUploadQueue();
      });
    }
  }

  function enqueueUpload(id, file) {
    uploadQueueRef.current.push({ id, file });
    pumpUploadQueue();
  }

  function handleFilesAccepted(files) {
    setSyncResult(null);
    const newCourses = files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      file,
      status: "queued",
      error: null,
      courseCode: "",
      courseName: "",
      semester: "",
    }));
    setCourses((prev) => [...prev, ...newCourses]);
    newCourses.forEach((c) => enqueueUpload(c.id, c.file));
  }

  function handleRetryCourse(id) {
    const course = courses.find((c) => c.id === id);
    if (!course?.file) return;
    updateCourse(id, { status: "queued", error: null });
    enqueueUpload(id, course.file);
  }

  function handleRemoveCourse(id) {
    removedCourseIdsRef.current.add(id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setEvents((prev) => prev.filter((e) => e.courseId !== id));
  }

  // --- Event editing -------------------------------------------------------

  function handleToggleSelect(id) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id && !e.needsReview ? { ...e, selected: !e.selected } : e))
    );
  }

  function handleToggleSelectAll(courseId, selectAll) {
    setEvents((prev) =>
      prev.map((e) =>
        e.courseId === courseId && !e.needsReview ? { ...e, selected: selectAll } : e
      )
    );
  }

  function handleEdit(id) {
    setEditingEvent(events.find((e) => e.id === id));
  }

  function handleAddManual(courseId) {
    const course = courses.find((c) => c.id === courseId);
    setEditingEvent({ courseId, course: course?.courseCode || "" });
  }

  function handleDelete(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function handleSaveEvent(eventData) {
    if (eventData.id) {
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== eventData.id) return e;
          // An edited event that was already synced goes back to unsynced;
          // syncing it again updates the existing Google event in place.
          const wasSynced = e.synced;
          return {
            ...e,
            ...eventData,
            synced: false,
            selected: eventData.needsReview ? false : wasSynced ? true : eventData.selected,
          };
        })
      );
    } else {
      setEvents((prev) => [...prev, { ...eventData, id: crypto.randomUUID(), synced: false }]);
    }
    setEditingEvent(null);
  }

  // --- Google Calendar -----------------------------------------------------

  const anyUploadsInFlight = courses.some((c) => c.status === "queued" || c.status === "processing");

  function handleConnectGoogle() {
    // The OAuth redirect leaves the page, which would abandon in-flight uploads.
    if (anyUploadsInFlight) return;
    startGoogleConnect();
  }

  async function handleDisconnectGoogle() {
    try {
      const status = await disconnectGoogle();
      setGoogleStatus((s) => ({ ...s, connected: status.connected }));
      setNotice(null);
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
    }
  }

  async function handleSync() {
    if (syncingRef.current) return;

    if (!googleStatus.connected) {
      if (anyUploadsInFlight) {
        setSyncResult({ error: "Wait for your syllabi to finish processing before connecting Google Calendar." });
        return;
      }
      startGoogleConnect();
      return;
    }

    const toSync = events.filter((e) => e.selected && !e.needsReview && e.date);
    if (toSync.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);
    setSyncResult(null);

    try {
      const { results } = await syncEventsToCalendar(calendarId, toSync.map(toSyncPayload));
      const byId = new Map(results.map((r) => [r.id, r]));

      setEvents((prev) =>
        prev.map((e) => {
          const r = byId.get(e.id);
          if (!r?.success) return e;
          return {
            ...e,
            synced: true,
            selected: false,
            googleEventId: r.googleEventId,
            googleHtmlLink: r.htmlLink,
            syncedCalendarId: calendarId,
          };
        })
      );

      const titleOf = (id) => toSync.find((e) => e.id === id)?.title || "Untitled event";
      setSyncResult({
        succeeded: results.filter((r) => r.success).map((r) => titleOf(r.id)),
        failed: results
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, title: titleOf(r.id), error: r.error })),
      });
    } catch (err) {
      if (err.status === 401) setGoogleStatus((s) => ({ ...s, connected: false }));
      setSyncResult({ error: err.message });
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  // --- Render --------------------------------------------------------------

  const readyCourses = courses.filter((c) => c.status === "ready");
  const readyIds = new Set(readyCourses.map((c) => c.id));
  const readyEvents = events.filter((e) => readyIds.has(e.courseId));
  const selectedCount = readyEvents.filter((e) => e.selected).length;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6">
        <Header
          googleStatus={googleStatus}
          connectDisabled={anyUploadsInFlight}
          onConnectGoogle={handleConnectGoogle}
          onDisconnectGoogle={handleDisconnectGoogle}
        />

        <main className="flex flex-col gap-6 pb-16">
          {notice && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                notice.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
              role="status"
            >
              {notice.kind === "success" ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <p className="flex-1">{notice.text}</p>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}

          <FileUpload compact={courses.length > 0} onFilesAccepted={handleFilesAccepted} />

          {courses.map((course) => {
            if (course.status === "queued" || course.status === "processing") {
              return (
                <LoadingState
                  key={course.id}
                  fileName={course.fileName}
                  queued={course.status === "queued"}
                />
              );
            }
            if (course.status === "error") {
              return (
                <UploadErrorCard
                  key={course.id}
                  course={course}
                  onRetry={handleRetryCourse}
                  onRemove={handleRemoveCourse}
                />
              );
            }
            return (
              <EventPreview
                key={course.id}
                course={course}
                events={events.filter((e) => e.courseId === course.id)}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddManual={handleAddManual}
                onRemoveCourse={handleRemoveCourse}
              />
            );
          })}

          {readyCourses.length > 0 && (
            <SyncSummary
              totalEvents={readyEvents.length}
              selectedCount={selectedCount}
              courseCount={readyCourses.length}
              googleStatus={googleStatus}
              calendars={googleStatus.connected ? calendars : []}
              calendarId={calendarId}
              onCalendarChange={setCalendarId}
              syncing={syncing}
              syncResult={syncResult}
              onSync={handleSync}
            />
          )}
        </main>
      </div>

      {editingEvent && (
        <EventEditor
          event={editingEvent}
          onSave={handleSaveEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}

export default App;
