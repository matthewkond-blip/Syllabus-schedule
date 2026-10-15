import { Calendar, CheckCircle2, Link2 } from "lucide-react";

export default function Header({ googleConnected, onConnectGoogle }) {
  return (
    <header className="flex items-center justify-between gap-4 py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">
          <Calendar size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">SyllabusSync</h1>
          <p className="text-sm text-gray-500">Your academic calendar, simplified</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onConnectGoogle}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
          googleConnected
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
        }`}
      >
        {googleConnected ? (
          <>
            <CheckCircle2 size={16} />
            Google Calendar Connected
          </>
        ) : (
          <>
            <Link2 size={16} />
            Connect Google Calendar
          </>
        )}
      </button>
    </header>
  );
}
