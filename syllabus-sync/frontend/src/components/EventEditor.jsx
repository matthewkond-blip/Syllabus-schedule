import { useState } from "react";
import { X } from "lucide-react";
import { EVENT_TYPES, REMINDER_OPTIONS } from "../services/eventTypes";

const EMPTY_EVENT = {
  title: "",
  course: "",
  type: "assignment",
  date: "",
  time: "",
  allDay: true,
  description: "",
  reminderMinutes: 60,
};

export default function EventEditor({ event, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_EVENT, ...event }));
  const [errors, setErrors] = useState({});

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = "Title is required.";
    if (!form.course.trim()) nextErrors.course = "Course is required.";
    if (!form.allDay && form.date && !form.time) {
      nextErrors.time = "Add a time, or mark this event as all-day.";
    }
    return nextErrors;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const needsReview = !form.date;
    onSave({
      ...form,
      id: event?.id,
      time: form.allDay ? null : form.time || null,
      needsReview,
      selected: needsReview ? false : form.selected ?? true,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            {event?.id ? "Edit Event" : "Add Event"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600">Event Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              placeholder="e.g. Assignment 1 Due"
            />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Course</label>
              <input
                type="text"
                value={form.course}
                onChange={(e) => update("course", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                placeholder="e.g. CP386"
              />
              {errors.course && <p className="mt-1 text-xs text-red-600">{errors.course}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Event Type</label>
              <select
                value={form.type}
                onChange={(e) => update("type", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Date</label>
              <input
                type="date"
                value={form.date || ""}
                onChange={(e) => update("date", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
              {!form.date && (
                <p className="mt-1 text-xs text-orange-600">
                  No date will mark this event as "Needs Review".
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Time</label>
              <input
                type="time"
                value={form.time || ""}
                onChange={(e) => update("time", e.target.value)}
                disabled={form.allDay}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              {errors.time && <p className="mt-1 text-xs text-red-600">{errors.time}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => update("allDay", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            All-day event
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-600">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">Reminder</label>
            <select
              value={form.reminderMinutes}
              onChange={(e) => update("reminderMinutes", Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            >
              {REMINDER_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Save Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
