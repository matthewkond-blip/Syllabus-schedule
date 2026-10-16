import { useRef, useState } from "react";
import { CloudUpload } from "lucide-react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function validateFile(file) {
  const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
  const hasValidType = ACCEPTED_TYPES.includes(file.type) || hasValidExtension;

  if (!hasValidType) {
    return `${file.name}: please upload a PDF or DOCX file.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${file.name}: larger than 10 MB. Please upload a smaller file.`;
  }
  return null;
}

export default function FileUpload({ compact, onFilesAccepted }) {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const inputRef = useRef(null);

  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const nextErrors = [];
    const accepted = [];
    for (const file of files) {
      const error = validateFile(file);
      if (error) nextErrors.push(error);
      else accepted.push(file);
    }

    setErrors(nextErrors);
    if (accepted.length > 0) onFilesAccepted(accepted);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-all ${
          compact ? "py-7" : "py-12"
        } ${isDragging ? "border-gray-900 bg-gray-50" : "border-gray-300 bg-gray-50/50"}`}
      >
        {!compact && (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <CloudUpload size={24} />
          </div>
        )}
        <h3 className="text-base font-semibold text-gray-900">
          {compact ? "Add another syllabus" : "Upload your syllabi"}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Drag and drop one or more PDF or DOCX files here
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
        >
          Browse Files
        </button>
        {!compact && (
          <p className="mt-4 text-xs text-gray-400">
            Accepted formats: PDF, DOCX (max 10 MB each) · one file per class
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so picking the same file again still fires onChange.
            e.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-red-600" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
