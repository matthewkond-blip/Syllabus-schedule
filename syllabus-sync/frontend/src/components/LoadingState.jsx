import { Loader2 } from "lucide-react";

const STAGE_LABELS = {
  reading: "Reading your syllabus...",
  analyzing: "Finding important dates...",
  preparing: "Preparing your events...",
};

export default function LoadingState({ stage }) {
  const label = STAGE_LABELS[stage] || "Working on it...";

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
      <Loader2 size={28} className="animate-spin text-gray-400" />
      <p className="mt-4 text-sm font-medium text-gray-700">{label}</p>
    </div>
  );
}
