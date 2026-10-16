import { CalendarPlus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function SyncSummary({
  totalEvents,
  selectedCount,
  courseCount,
  googleStatus,
  calendars,
  calendarId,
  onCalendarChange,
  syncing,
  syncResult,
  onSync,
}) {
  const disabled = syncing || selectedCount === 0 || !googleStatus.configured;

  let hint = "Only selected events will be added to your calendar.";
  if (!googleStatus.configured) {
    hint = "Google Calendar isn't set up on the server yet — see the README.";
  } else if (!googleStatus.connected) {
    hint = "You'll be asked to connect your Google account first.";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">
            Selected Events: {selectedCount} of {totalEvents}
            {courseCount > 1 && (
              <span className="font-normal text-gray-500"> across {courseCount} courses</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {googleStatus.connected && calendars.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="sr-only sm:not-sr-only">Calendar</span>
              <select
                value={calendarId}
                onChange={(e) => onCalendarChange(e.target.value)}
                disabled={syncing}
                className="max-w-[220px] rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={onSync}
            disabled={disabled}
            className="flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Adding events...
              </>
            ) : (
              <>
                <CalendarPlus size={16} />
                Add to Google Calendar
              </>
            )}
          </button>
        </div>
      </div>

      {syncResult && <SyncResultMessage result={syncResult} />}
    </div>
  );
}

function SyncResultMessage({ result }) {
  if (result.error) {
    return (
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <p>{result.error}</p>
      </div>
    );
  }

  const total = result.succeeded.length + result.failed.length;
  const allOk = result.failed.length === 0;

  return (
    <div
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        allOk
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-orange-200 bg-orange-50 text-orange-700"
      }`}
    >
      <div className="flex items-start gap-2">
        {allOk ? (
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        ) : (
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
        )}
        <div>
          <p className="font-medium">
            {allOk
              ? `${total} ${total === 1 ? "event" : "events"} successfully added to Google Calendar.`
              : `${result.succeeded.length} of ${total} events added to Google Calendar.`}
          </p>
          {result.failed.length > 0 && (
            <ul className="mt-1.5 list-inside list-disc space-y-0.5">
              {result.failed.map((f) => (
                <li key={f.id}>
                  Failed: {f.title}
                  {f.error ? ` — ${f.error}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
