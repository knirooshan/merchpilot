import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Search, X, Check, Loader2 } from "lucide-react";

/**
 * SearchableSelect
 * 
 * A rich, server-searchable or local dropdown select component.
 * Supports:
 * - Server-side debounced search with limit/pageSize (default: 10 items)
 * - Initial item loading on mount / first open
 * - Resolving existing/pre-selected values via selectedOption, initialLabel, or fetchOptionById
 * - Keyboard navigation (Up, Down, Enter, Escape)
 * - Click-outside dismiss
 * - Clear button
 * - Form validation integration (required)
 */
const SearchableSelect = ({
  value = "",
  onChange,
  loadOptions, // async (searchQuery) => Promise<Array<{ value, label, subtext?, ... }>>
  options = null, // static options fallback: Array<{ value, label, subtext? }>
  fixedOptions = [], // options that always appear at the top (e.g. "All Vendors", "Walk-in Customer")
  selectedOption = null, // { value, label, subtext? }
  initialLabel = "",
  fetchOptionById = null, // async (id) => Promise<{ value, label, subtext? }>
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  noOptionsMessage = "No results found",
  isClearable = true,
  disabled = false,
  required = false,
  name = "",
  id = "",
  className = "w-full",
  buttonClassName = "",
  debounceMs = 300,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [optionsList, setOptionsList] = useState([]);
  const [initialOptions, setInitialOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [currentLabel, setCurrentLabel] = useState(initialLabel || "");

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const activeRequestRef = useRef(0);
  const hasLoadedInitialRef = useRef(false);

  // Sync current label from selectedOption or initialLabel props if they change
  useEffect(() => {
    if (selectedOption?.label) {
      setCurrentLabel(selectedOption.label);
    } else if (initialLabel) {
      setCurrentLabel(initialLabel);
    } else if (!value) {
      setCurrentLabel("");
    }
  }, [selectedOption, initialLabel, value]);

  // If value is provided but label is unknown and fetchOptionById exists, fetch it
  useEffect(() => {
    let isCancelled = false;

    if (value && !currentLabel && typeof fetchOptionById === "function") {
      fetchOptionById(value)
        .then((opt) => {
          if (!isCancelled && opt) {
            setCurrentLabel(opt.label || opt.name || String(opt.value));
          }
        })
        .catch((err) => {
          console.error("Error fetching option by ID:", err);
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [value, currentLabel, fetchOptionById]);

  // Load initial options (e.g. top 10)
  const fetchInitialOptions = useCallback(async () => {
    if (loadOptions) {
      try {
        setIsLoading(true);
        const results = await loadOptions("");
        const safeResults = Array.isArray(results) ? results : [];
        setInitialOptions(safeResults);
        setOptionsList(safeResults);
        hasLoadedInitialRef.current = true;

        // If current value is in the results, update label if not already set
        if (value && !currentLabel) {
          const match = safeResults.find((opt) => String(opt.value) === String(value));
          if (match) {
            setCurrentLabel(match.label);
          }
        }
      } catch (error) {
        console.error("Error loading initial options:", error);
      } finally {
        setIsLoading(false);
      }
    } else if (Array.isArray(options)) {
      setInitialOptions(options);
      setOptionsList(options);
      hasLoadedInitialRef.current = true;

      if (value && !currentLabel) {
        const match = options.find((opt) => String(opt.value) === String(value));
        if (match) {
          setCurrentLabel(match.label);
        }
      }
    }
  }, [loadOptions, options, value, currentLabel]);

  // Perform search with debounce
  const executeSearch = useCallback(
    async (query) => {
      if (!loadOptions) {
        // Local filtering
        if (!query.trim()) {
          setOptionsList(initialOptions);
        } else {
          const q = query.toLowerCase();
          const filtered = (options || initialOptions).filter((opt) =>
            (opt.label || "").toLowerCase().includes(q) ||
            (opt.subtext || "").toLowerCase().includes(q)
          );
          setOptionsList(filtered);
        }
        setHighlightedIndex(-1);
        return;
      }

      // Server-side search
      const requestId = ++activeRequestRef.current;
      setIsLoading(true);
      try {
        const results = await loadOptions(query.trim());
        if (requestId === activeRequestRef.current) {
          setOptionsList(Array.isArray(results) ? results : []);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        if (requestId === activeRequestRef.current) {
          console.error("Error searching options:", error);
          setOptionsList([]);
        }
      } finally {
        if (requestId === activeRequestRef.current) {
          setIsLoading(false);
        }
      }
    },
    [loadOptions, options, initialOptions]
  );

  // Debounce search input changes
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchTerm.trim()) {
      if (hasLoadedInitialRef.current) {
        setOptionsList(initialOptions);
        setIsLoading(false);
      } else {
        fetchInitialOptions();
      }
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(searchTerm);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, isOpen, debounceMs, executeSearch, initialOptions, fetchInitialOptions]);

  // Open/Close toggle
  const toggleDropdown = () => {
    if (disabled) return;
    if (!isOpen) {
      setIsOpen(true);
      setSearchTerm("");
      if (!hasLoadedInitialRef.current) {
        fetchInitialOptions();
      } else {
        setOptionsList(initialOptions);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setIsOpen(false);
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Handle selecting an option
  const handleSelect = (option) => {
    setCurrentLabel(option.label || "");
    setIsOpen(false);
    setSearchTerm("");
    if (onChange) {
      onChange(option.value, option);
    }
  };

  // Handle clear
  const handleClear = (e) => {
    e.stopPropagation();
    setCurrentLabel("");
    if (onChange) {
      onChange("", null);
    }
  };

  // Combined options (fixed options on top + fetched options)
  const combinedOptions = [
    ...fixedOptions,
    ...optionsList.filter(
      (opt) => !fixedOptions.some((fo) => String(fo.value) === String(opt.value))
    ),
  ];

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        toggleDropdown();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < combinedOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : combinedOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < combinedOptions.length) {
        handleSelect(combinedOptions[highlightedIndex]);
      }
    }
  };

  const hasValue = value !== "" && value !== null && value !== undefined;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for native HTML form validation */}
      <input
        type="text"
        tabIndex={-1}
        className="sr-only"
        required={required}
        value={hasValue ? String(value) : ""}
        onChange={() => { }}
        name={name}
        id={id}
        aria-hidden="true"
      />

      {/* Select Trigger Button */}
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full bg-slate-950 border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent rounded-md py-2 px-3 text-sm text-left flex items-center justify-between transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span
          className={`truncate pr-2 ${hasValue && currentLabel ? "text-white" : "text-slate-400"
            }`}
        >
          {hasValue && currentLabel ? currentLabel : placeholder}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {isClearable && hasValue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleClear(e);
                }
              }}
              title="Clear selection"
              className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-400" : ""
              }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 min-w-[220px]">
          {/* Search Input Box */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 pl-8 pr-7 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div
            role="listbox"
            className="max-h-56 overflow-y-auto custom-scrollbar p-1 space-y-0.5"
          >
            {isLoading ? (
              <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>Searching records...</span>
              </div>
            ) : combinedOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-slate-500 text-xs">
                {searchTerm
                  ? `No matches found for "${searchTerm}"`
                  : noOptionsMessage}
              </div>
            ) : (
              combinedOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between group ${isSelected
                        ? "bg-blue-600/20 text-blue-300 font-medium"
                        : isHighlighted
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-medium truncate">{opt.label}</div>
                      {opt.subtext && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {opt.subtext}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
