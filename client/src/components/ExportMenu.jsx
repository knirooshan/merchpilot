import { useState, useRef, useEffect } from "react";
import {
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileJson,
  FileCode,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { exportData } from "../utils/exportData";

const FORMAT_OPTIONS = [
  {
    id: "csv",
    label: "Export as CSV",
    icon: FileSpreadsheet,
    description: "Spreadsheet compatible",
  },
  {
    id: "json",
    label: "Export as JSON",
    icon: FileJson,
    description: "Structured data",
  },
  {
    id: "xml",
    label: "Export as XML",
    icon: FileCode,
    description: "Standard markup",
  },
];

const hasExportableData = (rawData) => {
  if (rawData === null || rawData === undefined) return false;
  if (Array.isArray(rawData)) return rawData.length > 0;
  if (typeof rawData === "object") return Object.keys(rawData).length > 0;
  return Boolean(rawData);
};

const ExportMenu = ({
  filename = "export",
  columns,
  data,
  fetchData,
  prepareExport,
  rootName = "records",
  itemName = "record",
  label = "Export",
  size = "md",
  disabled = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectFormat = async (format) => {
    setIsOpen(false);
    setIsExporting(true);

    try {
      const resolvedData =
        typeof fetchData === "function" ? await fetchData() : data;

      if (!hasExportableData(resolvedData)) {
        toast.error("No data available to export");
        return;
      }

      exportData(format, {
        data: resolvedData,
        columns,
        filename,
        rootName,
        itemName,
        prepareExport,
      });

      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error(`Error exporting as ${format}:`, error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          `Failed to export as ${format.toUpperCase()}`
      );
    } finally {
      setIsExporting(false);
    }
  };

  const buttonSizeClasses =
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm font-medium";

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled || isExporting}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonSizeClasses}`}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        ) : (
          <Download className="h-4 w-4 text-slate-300" />
        )}
        <span>{isExporting ? "Exporting..." : label}</span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1"
        >
          {FORMAT_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => handleSelectFormat(option.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
