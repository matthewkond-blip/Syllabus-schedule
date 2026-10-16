const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options, fallbackMessage) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new ApiError(0, "Can't reach the SyllabusSync server. Is the backend running?");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || fallbackMessage);
  }
  return res.json();
}

export function uploadSyllabus(file) {
  const formData = new FormData();
  formData.append("syllabus", file);
  return request(
    "/api/syllabus/upload",
    { method: "POST", body: formData },
    "Failed to process syllabus."
  );
}

export function getGoogleStatus() {
  return request("/api/auth/status", undefined, "Couldn't check Google Calendar connection.");
}

// OAuth is a full-page redirect through Google and back to the app. Events
// survive it because App persists them to localStorage.
export function startGoogleConnect() {
  window.location.assign(`${API_BASE_URL}/api/auth/google`);
}

export function disconnectGoogle() {
  return request("/api/auth/logout", { method: "POST" }, "Couldn't disconnect Google Calendar.");
}

export function listCalendars() {
  return request("/api/calendar/calendars", undefined, "Couldn't load your calendars.");
}

export function syncEventsToCalendar(calendarId, events) {
  return request(
    "/api/calendar/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId, events }),
    },
    "Failed to add events to Google Calendar."
  );
}
