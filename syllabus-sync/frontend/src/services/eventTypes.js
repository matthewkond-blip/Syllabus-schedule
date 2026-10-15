export const EVENT_TYPES = [
  { value: "assignment", label: "Assignment", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "quiz", label: "Quiz", classes: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "midterm", label: "Midterm", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "final", label: "Final Exam", classes: "bg-red-50 text-red-700 border-red-200" },
  { value: "project", label: "Project", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "presentation", label: "Presentation", classes: "bg-teal-50 text-teal-700 border-teal-200" },
  { value: "other", label: "Other", classes: "bg-gray-100 text-gray-700 border-gray-200" },
];

export function getEventTypeMeta(type) {
  return EVENT_TYPES.find((t) => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

export const REMINDER_OPTIONS = [
  { value: 0, label: "No reminder" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
  { value: 2880, label: "2 days before" },
];

export function formatDate(dateStr) {
  if (!dateStr) return "Needs review";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hour, minute] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
