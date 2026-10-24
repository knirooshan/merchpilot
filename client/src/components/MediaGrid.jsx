import { useState } from "react";
import { Trash2, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { ENDPOINTS } from "../config/api";
import toast from "react-hot-toast";

const MediaGrid = ({ onSelect, selectable = false, refreshTrigger }) => {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);

  const { data: mediaData, isLoading: loading } = useQuery({
    queryKey: ["media", refreshTrigger],
    queryFn: async () => {
      const response = await apiClient.get(ENDPOINTS.MEDIA);
      return Array.isArray(response.data) ? response.data : response.data?.data || [];
    },
  });
  const media = mediaData || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(ENDPOINTS.MEDIA_BY_ID(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success("Image deleted");
    },
    onError: (error) => {
      console.error("Error deleting media:", error);
      toast.error("Failed to delete media");
    },
  });

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    deleteMutation.mutate(id);
  };

  const handleSelect = (item) => {
    if (selectable) {
      setSelectedId(item._id);
      if (onSelect) {
        onSelect(item);
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center text-slate-400 py-8">Loading media...</div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        No media found. Upload some images to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {media.map((item) => (
        <div
          key={item._id}
          className={`relative group aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${selectable && selectedId === item._id
            ? "border-blue-500 ring-2 ring-blue-500 ring-opacity-50"
            : "border-slate-800 hover:border-slate-600"
            }`}
          onClick={() => handleSelect(item)}
        >
          <img
            src={item.url}
            alt={item.filename}
            className="w-full h-full object-cover"
          />

          {/* Overlay for actions */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            {!selectable && (
              <button
                onClick={(e) => handleDelete(e, item._id)}
                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Selection Indicator */}
          {selectable && selectedId === item._id && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
              <Check className="h-3 w-3" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MediaGrid;
