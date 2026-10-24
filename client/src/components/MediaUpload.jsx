import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader, AlertCircle, CheckCircle } from "lucide-react";
import apiClient from "../api/apiClient";
import { useSelector } from "react-redux";
import { ENDPOINTS } from "../config/api";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

// status: 'pending' | 'uploading' | 'success' | 'error'
let nextId = 0;

const MediaUpload = ({ onUploadComplete }) => {
  const { user } = useSelector((state) => state.auth);
  const [isDragging, setIsDragging] = useState(false);
  const [fileQueue, setFileQueue] = useState([]); // { id, file, status, error }
  const fileInputRef = useRef(null);

  const updateFile = useCallback((id, patch) => {
    setFileQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const uploadSingle = useCallback(
    async (entry) => {
      const { id, file } = entry;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        updateFile(id, {
          status: "error",
          error: "Unsupported file type. Please upload a JPEG, PNG, GIF, WebP, or SVG image.",
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        updateFile(id, {
          status: "error",
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`,
        });
        return;
      }

      updateFile(id, { status: "uploading" });

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await apiClient.post(ENDPOINTS.MEDIA_UPLOAD, formData);
        updateFile(id, { status: "success" });
        if (onUploadComplete) {
          onUploadComplete(response.data);
        }
      } catch (error) {
        const msg =
          error.response?.data?.message ||
          (error.request
            ? "No response from server. Please check your connection."
            : error.message) ||
          "Upload failed. Please try again.";
        updateFile(id, { status: "error", error: msg });
      }
    },
    [user, onUploadComplete, updateFile],
  );

  const enqueueFiles = useCallback(
    (rawFiles) => {
      const entries = Array.from(rawFiles).map((file) => ({
        id: ++nextId,
        file,
        status: "pending",
        error: null,
      }));
      setFileQueue((prev) => [...prev, ...entries]);
      entries.forEach((entry) => uploadSingle(entry));
    },
    [uploadSingle],
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      enqueueFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      enqueueFiles(e.target.files);
      e.target.value = "";
    }
  };

  const removeEntry = (id) => {
    setFileQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const isAnyUploading = fileQueue.some((f) => f.status === "uploading" || f.status === "pending");

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-slate-700 hover:border-slate-600 bg-slate-900/50"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*"
          multiple
        />

        <div
          className="flex flex-col items-center justify-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {isAnyUploading ? (
            <Loader className="h-10 w-10 text-blue-400 animate-spin mb-2" />
          ) : (
            <Upload className="h-10 w-10 text-slate-400 mb-2" />
          )}
          <p className="text-slate-300 font-medium mb-1">
            {isAnyUploading
              ? "Uploading…"
              : "Click to upload or drag and drop"}
          </p>
          <p className="text-slate-500 text-sm">
            JPEG, PNG, GIF, WebP or SVG &mdash; up to 10 MB each &mdash; multiple files supported
          </p>
        </div>
      </div>

      {fileQueue.length > 0 && (
        <ul className="space-y-2">
          {fileQueue.map(({ id, file, status, error }) => (
            <li
              key={id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${status === "error"
                  ? "bg-red-900/40 border-red-700 text-red-300"
                  : status === "success"
                    ? "bg-green-900/30 border-green-700 text-green-300"
                    : "bg-slate-900/50 border-slate-700 text-slate-400"
                }`}
            >
              {status === "uploading" || status === "pending" ? (
                <Loader className="h-4 w-4 mt-0.5 animate-spin shrink-0" />
              ) : status === "success" ? (
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{file.name}</p>
                {error && <p className="text-xs mt-0.5 opacity-80">{error}</p>}
              </div>
              {(status === "success" || status === "error") && (
                <button
                  className="ml-auto shrink-0 opacity-70 hover:opacity-100"
                  onClick={() => removeEntry(id)}
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MediaUpload;
