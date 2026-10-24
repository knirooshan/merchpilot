import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/**
 * Universal, responsive Pagination component for MerchPilot tables.
 */
const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 15,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50, 100],
  itemName = "items",
}) => {
  const [jumpInput, setJumpInput] = useState("");

  if (totalPages <= 1 && totalItems <= pageSize && !onPageSizeChange) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    ];
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpInput("");
    }
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="bg-slate-950 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-800 text-sm text-slate-400 select-none">
      {/* Left: Info and Page Size Selector */}
      <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-start">
        {totalItems > 0 ? (
          <div>
            Showing{" "}
            <span className="font-medium text-white">{startItem}</span> to{" "}
            <span className="font-medium text-white">{endItem}</span> of{" "}
            <span className="font-medium text-white">
              {totalItems.toLocaleString()}
            </span>{" "}
            {itemName}
          </div>
        ) : (
          <div>
            Page <span className="font-medium text-white">{currentPage}</span> of{" "}
            <span className="font-medium text-white">{Math.max(1, totalPages)}</span>
          </div>
        )}

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Navigation Controls & Quick Jump */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
        {/* Buttons */}
        <div className="inline-flex items-center gap-1">
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            title="First Page"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsLeft size={16} />
          </button>

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous Page"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Numbered buttons */}
          <div className="hidden sm:inline-flex items-center gap-1">
            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-slate-600">
                  ...
                </span>
              ) : (
                <button
                  key={`page-${p}`}
                  onClick={() => onPageChange(p)}
                  className={`min-w-[32px] h-8 px-2 rounded text-xs font-medium border transition-colors ${currentPage === p
                      ? "bg-blue-600 border-blue-500 text-white font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          {/* Mobile page indicator */}
          <span className="sm:hidden text-xs px-2 text-slate-300 font-medium">
            {currentPage} / {totalPages}
          </span>

          {/* Next Page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next Page"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>

          {/* Last Page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title="Last Page"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        {/* Quick Jump Input (shown when pages > 4) */}
        {totalPages > 4 && (
          <form
            onSubmit={handleJumpSubmit}
            className="flex items-center gap-1 text-xs"
          >
            <span className="text-slate-500">Go to:</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder="#"
              className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Pagination;
