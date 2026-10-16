import { Calendar, CheckCircle2, Link2 } from "lucide-react";

export default function Header({ googleStatus, connectDisabled, onConnectGoogle, onDisconnectGoogle }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">
          <Calendar size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">SyllabusSync</h1>
          <p className="text-sm text-gray-500">Your academic calendar, simplified</p>
        </div>
      </div>

      {googleStatus.connected ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 size={16} />
            Google Calendar Connected
          </span>
          <button
            type="button"
            onClick={onDisconnectGoogle}
            className="rounded-full px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onConnectGoogle}
          disabled={!googleStatus.configured || connectDisabled}
          title={
            !googleStatus.configured
              ? "Add Google OAuth credentials to backend/.env first"
              : connectDisabled
                ? "Wait for syllabi to finish processing"
                : undefined
          }
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Link2 size={16} />
          Connect Google Calendar
        </button>
      )}
    </header>
  );
}
