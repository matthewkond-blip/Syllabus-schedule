import { CalendarPlus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function SyncSummary({
  totalEvents,
  selectedCount,
  syncing,
  syncResult,
  onSync,
}) {
  const disabled = syncing || selectedCount === 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">
            Selected Events: {selectedCount} of {totalEvents}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Only selected events will be added to your calendar.
          </p>
        </div>

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

      {syncResult && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            syncResult.failed.length === 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-orange-200 bg-orange-50 text-orange-700"
          }`}
        >
          <div className="flex items-start gap-2">
            {syncResult.failed.length === 0 ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-medium">
                {syncResult.succeeded.length} of {syncResult.succeeded.length + syncResult.failed.length}{" "}
                events successfully added to Google Calendar.
              </p>
              {syncResult.failed.length > 0 && (
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  {syncResult.failed.map((title) => (
                    <li key={title}>Failed: {title}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
