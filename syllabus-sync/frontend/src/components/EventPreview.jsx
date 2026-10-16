import { useState } from "react";
import { CheckSquare, Square, Plus, BookOpen, ChevronDown, X } from "lucide-react";
import EventRow from "./EventRow";

export default function EventPreview({
  course,
  events,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onAddManual,
  onRemoveCourse,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const selectableEvents = events.filter((e) => !e.needsReview);
  const allSelected =
    selectableEvents.length > 0 && selectableEvents.every((e) => e.selected);
  const selectedCount = events.filter((e) => e.selected).length;
  const reviewCount = events.length - selectableEvents.length;

  const title = [course.courseCode, course.courseName].filter(Boolean).join(" — ") || course.fileName;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex min-w-0 items-start gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <ChevronDown
            size={18}
            className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">{title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
              <BookOpen size={14} />
              {course.semester && (
                <>
                  <span>{course.semester}</span>
                  <span className="text-gray-300">•</span>
                </>
              )}
              <span>
                {events.length} {events.length === 1 ? "event" : "events"}
                {collapsed && ` · ${selectedCount} selected`}
              </span>
              {reviewCount > 0 && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-orange-600">{reviewCount} need review</span>
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {!collapsed && (
            <>
              <button
                type="button"
                onClick={() => onToggleSelectAll(course.id, !allSelected)}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                Select All
              </button>
              <button
                type="button"
                onClick={() => onAddManual(course.id)}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus size={15} />
                Add Event
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onRemoveCourse(course.id)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={`Remove ${title}`}
            title="Remove this course"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {!collapsed &&
        (events.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            No events found. Add one manually.
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
        ))}
    </div>
  );
}
