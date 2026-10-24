import { useState } from "react";
import { X } from "lucide-react";
import MediaGrid from "./MediaGrid";
import MediaUpload from "./MediaUpload";

const MediaLibraryModal = ({ isOpen, onClose, onSelect }) => {
  const [activeTab, setActiveTab] = useState("library"); // 'library' or 'upload'
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!isOpen) return null;

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab("library");
  };

  const handleSelect = (media) => {
    onSelect(media);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col border border-slate-800">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h3 className="text-lg font-medium text-white">Media Library</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-800">
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "library"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-slate-400 hover:text-white"
              }`}
            onClick={() => setActiveTab("library")}
          >
            Media Library
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "upload"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-slate-400 hover:text-white"
              }`}
            onClick={() => setActiveTab("upload")}
          >
            Upload Files
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "library" ? (
            <MediaGrid
              selectable={true}
              onSelect={handleSelect}
              refreshTrigger={refreshTrigger}
            />
          ) : (
            <div className="max-w-xl mx-auto mt-8">
              <MediaUpload onUploadComplete={handleUploadComplete} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaLibraryModal;
