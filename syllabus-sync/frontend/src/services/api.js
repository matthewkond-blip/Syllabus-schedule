const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function uploadSyllabus(file) {
  const formData = new FormData();
  formData.append("syllabus", file);

  const res = await fetch(`${API_BASE_URL}/api/syllabus/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to process syllabus.");
  }

  return res.json();
}
