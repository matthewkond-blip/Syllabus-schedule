import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// The backend reads, analyzes, and prepares within a single request; these
// timings just advance the label to roughly match how long each step takes.
const STAGES = [
  { label: "Reading your syllabus...", after: 0 },
  { label: "Finding important dates...", after: 800 },
  { label: "Preparing your events...", after: 2200 },
];

export default function LoadingState({ fileName, queued }) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (queued) return undefined;
    const timers = STAGES.slice(1).map((stage, i) =>
      setTimeout(() => setStageIndex(i + 1), stage.after)
    );
    return () => timers.forEach(clearTimeout);
  }, [queued]);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <Loader2 size={22} className={`shrink-0 text-gray-400 ${queued ? "" : "animate-spin"}`} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{fileName}</p>
        <p className="mt-0.5 text-sm text-gray-500">
          {queued ? "Waiting in line..." : STAGES[stageIndex].label}
        </p>
      </div>
    </div>
  );
}
