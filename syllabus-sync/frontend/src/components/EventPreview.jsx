import { CheckSquare, Square, Plus, BookOpen } from "lucide-react";
import EventRow from "./EventRow";

export default function EventPreview({
  courseInfo,
  events,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onAddManual,
}) {
  const selectableEvents = events.filter((e) => !e.needsReview);
  const allSelected =
    selectableEvents.length > 0 && selectableEvents.every((e) => e.selected);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Extracted Events</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <BookOpen size={14} />
            <span>
              {courseInfo.courseCode} — {courseInfo.courseName} ({courseInfo.semester})
            </span>
            <span className="text-gray-300">•</span>
            <span>
              {events.length} {events.length === 1 ? "event" : "events"} found
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleSelectAll(!allSelected)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            Select All
          </button>
          <button
            type="button"
            onClick={onAddManual}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus size={15} />
            Add Event
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-500">
          No events yet. Add one manually or upload a syllabus.
        </p>
      ) : (
        <div>
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
