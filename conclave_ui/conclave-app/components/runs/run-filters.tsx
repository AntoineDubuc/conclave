"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useTransition } from "react";

interface RunFiltersProps {
  initialSearch?: string;
  initialFlowType?: string;
  initialStatus?: string;
}

export function RunFilters({
  initialSearch = "",
  initialFlowType = "all",
  initialStatus = "all",
}: RunFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [flowType, setFlowType] = useState(initialFlowType);
  const [status, setStatus] = useState(initialStatus);

  // Update URL with filters
  const updateFilters = useCallback(
    (newSearch: string, newFlowType: string, newStatus: string) => {
      const params = new URLSearchParams();

      if (newSearch) {
        params.set("search", newSearch);
      }
      if (newFlowType && newFlowType !== "all") {
        params.set("flow_type", newFlowType);
      }
      if (newStatus && newStatus !== "all") {
        params.set("status", newStatus);
      }
      // Reset to page 1 when filters change
      // Don't set page=1 explicitly, just omit it

      const queryString = params.toString();
      startTransition(() => {
        router.push(`/runs${queryString ? `?${queryString}` : ""}`);
      });
    },
    [router]
  );

  // Debounced search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== initialSearch) {
        updateFilters(search, flowType, status);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, flowType, status, initialSearch, updateFilters]);

  const handleFlowTypeChange = (value: string) => {
    setFlowType(value);
    updateFilters(search, value, status);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    updateFilters(search, flowType, value);
  };

  const hasFilters =
    search !== "" || flowType !== "all" || status !== "all";

  const clearFilters = () => {
    setSearch("");
    setFlowType("all");
    setStatus("all");
    startTransition(() => {
      router.push("/runs");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search runs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:bg-white/10 focus:border-white/20 focus:outline-none transition-all"
          />
          {isPending && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Flow type filter */}
        <select
          value={flowType}
          onChange={(e) => handleFlowTypeChange(e.target.value)}
          className="w-full sm:w-[160px] px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:bg-white/10 focus:border-white/20 focus:outline-none transition-all appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.75rem center",
            backgroundSize: "1rem",
          }}
        >
          <option value="all">All Flow Types</option>
          <option value="round-robin">Round Robin</option>
          <option value="hub-and-spoke">Hub & Spoke</option>
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full sm:w-[140px] px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:bg-white/10 focus:border-white/20 focus:outline-none transition-all appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.75rem center",
            backgroundSize: "1rem",
          }}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="running">Running</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Clear filters button */}
      {hasFilters && (
        <div className="flex items-center gap-2">
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
          <span className="text-sm text-white/40">
            Showing filtered results
          </span>
        </div>
      )}
    </div>
  );
}
