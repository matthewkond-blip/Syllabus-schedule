import { CheckSquare, Square, Pencil, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { getEventTypeMeta, formatDate, formatTime } from "../services/eventTypes";

export default function EventRow({ event, onToggleSelect, onEdit, onDelete }) {
  const typeMeta = getEventTypeMeta(event.type);

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 last:border-b-0 hover:bg-gray-50/70">
      <button
        type="button"
        onClick={() => onToggleSelect(event.id)}
        disabled={event.needsReview}
        className="shrink-0 text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={event.selected ? "Deselect event" : "Select event"}
      >
        {event.selected ? (
          <CheckSquare size={19} className="text-gray-900" />
        ) : (
          <Square size={19} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{event.title}</p>
          {event.synced && (
            <a
              href={event.googleHtmlLink || undefined}
              target="_blank"
              rel="noreferrer"
              title={event.googleHtmlLink ? "Open in Google Calendar" : undefined}
              className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <CheckCircle2 size={11} />
              Synced
            </a>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${typeMeta.classes}`}
          >
            {typeMeta.label}
          </span>
          {event.needsReview ? (
            <span className="flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
              <AlertCircle size={11} />
              Needs review
            </span>
          ) : (
            <span className="text-xs text-gray-500">
              {formatDate(event.date)}
              {!event.allDay && event.time ? ` · ${formatTime(event.time)}` : ""}
              {event.allDay ? " · All day" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(event.id)}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Edit event"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(event.id)}
          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Delete event"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
