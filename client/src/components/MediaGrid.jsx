import { useState, useEffect } from "react";
import { Trash2, Check } from "lucide-react";
import axios from "axios";
import { useSelector } from "react-redux";
import { ENDPOINTS } from "../config/api";

const MediaGrid = ({ onSelect, selectable = false, refreshTrigger }) => {
  const { user } = useSelector((state) => state.auth);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const fetchMedia = async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const response = await axios.get(
        ENDPOINTS.MEDIA,
        config
      );
      setMedia(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching media:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [refreshTrigger]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this image?")) return;

    try {
      const token = localStorage.getItem("token");
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      await axios.delete(ENDPOINTS.MEDIA_BY_ID(id), config);
      fetchMedia();
    } catch (error) {
      console.error("Error deleting media:", error);
      alert("Failed to delete media");
    }
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
