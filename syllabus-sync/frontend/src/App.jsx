import { useRef, useState } from "react";
import Header from "./components/Header";
import FileUpload from "./components/FileUpload";
import LoadingState from "./components/LoadingState";
import EventPreview from "./components/EventPreview";
import EventEditor from "./components/EventEditor";
import SyncSummary from "./components/SyncSummary";
import { uploadSyllabus } from "./services/api";

let nextManualId = 100;

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [processingStage, setProcessingStage] = useState(null);
  const [courseInfo, setCourseInfo] = useState(null);
  const [events, setEvents] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const requestIdRef = useRef(0);

  const isProcessing = processingStage !== null;

  async function handleFileAccepted(file) {
    const requestId = ++requestIdRef.current;

    setSelectedFile(file);
    setSyncResult(null);
    setUploadError(null);
    setCourseInfo(null);
    setEvents([]);
    setProcessingStage("reading");

    // The backend does these steps in order within a single request; these
    // timers just advance the label to match roughly how long each takes.
    const analyzingTimer = setTimeout(() => {
      if (requestIdRef.current === requestId) setProcessingStage("analyzing");
    }, 800);
    const preparingTimer = setTimeout(() => {
      if (requestIdRef.current === requestId) setProcessingStage("preparing");
    }, 2200);

    try {
      const result = await uploadSyllabus(file);
      if (requestIdRef.current !== requestId) return;
      setCourseInfo(result.course);
      setEvents(result.events);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setUploadError(err.message || "Something went wrong while processing your syllabus.");
    } finally {
      clearTimeout(analyzingTimer);
      clearTimeout(preparingTimer);
      if (requestIdRef.current === requestId) setProcessingStage(null);
    }
  }

  function handleClearFile() {
    requestIdRef.current += 1;
    setSelectedFile(null);
    setProcessingStage(null);
    setCourseInfo(null);
    setEvents([]);
    setSyncResult(null);
    setUploadError(null);
  }

  function handleToggleSelect(id) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e))
    );
  }

  function handleToggleSelectAll(selectAll) {
    setEvents((prev) =>
      prev.map((e) => (e.needsReview ? e : { ...e, selected: selectAll }))
    );
  }

  function handleEdit(id) {
    const event = events.find((e) => e.id === id);
    setEditingEvent(event);
    setIsEditorOpen(true);
  }

  function handleAddManual() {
    setEditingEvent({ course: courseInfo?.courseCode || "" });
    setIsEditorOpen(true);
  }

  function handleDelete(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function handleSaveEvent(eventData) {
    if (eventData.id) {
      setEvents((prev) =>
        prev.map((e) => (e.id === eventData.id ? { ...e, ...eventData } : e))
      );
    } else {
      setEvents((prev) => [
        ...prev,
        { ...eventData, id: `evt-manual-${nextManualId++}`, synced: false },
      ]);
    }
    setIsEditorOpen(false);
    setEditingEvent(null);
  }

  function handleCloseEditor() {
    setIsEditorOpen(false);
    setEditingEvent(null);
  }

  function handleConnectGoogle() {
    // Mocked for Phase 2 — real OAuth flow is implemented in Phase 5.
    setGoogleConnected((prev) => !prev);
  }

  function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);

    setTimeout(() => {
      const selected = events.filter((e) => e.selected);
      setEvents((prev) =>
        prev.map((e) => (e.selected ? { ...e, synced: true, selected: false } : e))
      );
      setSyncResult({
        succeeded: selected.map((e) => e.title),
        failed: [],
      });
      setSyncing(false);
    }, 1200);
  }

  const selectedCount = events.filter((e) => e.selected).length;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6">
        <Header googleConnected={googleConnected} onConnectGoogle={handleConnectGoogle} />

        <main className="flex flex-col gap-6 pb-16">
          <FileUpload
            selectedFile={selectedFile}
            disabled={isProcessing}
            onFileAccepted={handleFileAccepted}
            onClear={handleClearFile}
            serverError={uploadError}
          />

          {isProcessing && <LoadingState stage={processingStage} />}

          {!isProcessing && courseInfo && (
            <>
              <EventPreview
                courseInfo={courseInfo}
                events={events}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddManual={handleAddManual}
              />

              <SyncSummary
                totalEvents={events.length}
                selectedCount={selectedCount}
                syncing={syncing}
                syncResult={syncResult}
                onSync={handleSync}
              />
            </>
          )}
        </main>
      </div>

      {isEditorOpen && (
        <EventEditor
          event={editingEvent}
          onSave={handleSaveEvent}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}

export default App;
