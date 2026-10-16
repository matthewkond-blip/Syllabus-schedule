import { AlertCircle, RotateCw, X } from "lucide-react";

export default function UploadErrorCard({ course, onRetry, onRemove }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-white px-5 py-4 shadow-sm">
      <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{course.fileName}</p>
        <p className="mt-0.5 text-sm text-red-600">{course.error}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {course.file && (
          <button
            type="button"
            onClick={() => onRetry(course.id)}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <RotateCw size={13} />
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(course.id)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label={`Dismiss ${course.fileName}`}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
