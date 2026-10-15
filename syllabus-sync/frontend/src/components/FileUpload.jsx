import { useRef, useState } from "react";
import { CloudUpload, FileText, X } from "lucide-react";

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
    return "Please upload a PDF or DOCX file.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "That file is larger than 10 MB. Please upload a smaller file.";
  }
  return null;
}

export default function FileUpload({ selectedFile, disabled, onFileAccepted, onClear, serverError }) {
  const [isDragging, setIsDragging] = useState(false);
  const [clientError, setClientError] = useState(null);
  const inputRef = useRef(null);

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setClientError(validationError);
      return;
    }

    setClientError(null);
    onFileAccepted(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleBrowseClick() {
    if (disabled) return;
    inputRef.current?.click();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          isDragging
            ? "border-gray-900 bg-gray-50"
            : "border-gray-300 bg-gray-50/50"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {selectedFile ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <FileText size={24} />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-900">{selectedFile.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            {!disabled && (
              <button
                type="button"
                onClick={onClear}
                className="mt-4 flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                <X size={14} />
                Remove file
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <CloudUpload size={24} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900">Upload your syllabus</h3>
            <p className="mt-1 text-sm text-gray-500">
              Drag and drop your PDF or DOCX file here
            </p>
            <button
              type="button"
              onClick={handleBrowseClick}
              disabled={disabled}
              className="mt-5 rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Browse Files
            </button>
            <p className="mt-4 text-xs text-gray-400">Accepted formats: PDF, DOCX (max 10 MB)</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {(clientError || serverError) && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {clientError || serverError}
        </p>
      )}
    </div>
  );
}
