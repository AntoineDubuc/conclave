"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  // For Server Component usage with URL-based pagination
  baseUrl?: string;
  searchParams?: Record<string, string>;
}

function PageButton({
  page,
  children,
  disabled,
  className,
  ariaLabel,
  baseUrl,
  buildPageUrl,
  handlePageChange,
}: {
  page: number;
  children: React.ReactNode;
  disabled?: boolean;
  className: string;
  ariaLabel: string;
  baseUrl?: string;
  buildPageUrl: (page: number) => string;
  handlePageChange: (page: number) => void;
}) {
  if (baseUrl && !disabled) {
    return (
      <Link href={buildPageUrl(page)} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button
      onClick={() => !disabled && handlePageChange(page)}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  baseUrl,
  searchParams = {},
}: PaginationProps) {
  const router = useRouter();
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Build URL for page navigation
  const buildPageUrl = (page: number) => {
    if (!baseUrl) return "#";
    const params = new URLSearchParams(searchParams);
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const queryString = params.toString();
    return `${baseUrl}${queryString ? `?${queryString}` : ""}`;
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else if (baseUrl) {
      router.push(buildPageUrl(page));
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or less
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-white/60">
        Page {currentPage} of {totalPages}
      </p>

      <div className="flex items-center gap-1">
        {/* Previous button */}
        <PageButton
          page={currentPage - 1}
          disabled={!canGoPrevious}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          ariaLabel="Previous page"
          baseUrl={baseUrl}
          buildPageUrl={buildPageUrl}
          handlePageChange={handlePageChange}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </PageButton>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 py-2 text-white/40"
              >
                ...
              </span>
            ) : (
              <PageButton
                key={page}
                page={page}
                className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === page
                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white"
                    : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
                ariaLabel={`Go to page ${page}`}
                baseUrl={baseUrl}
                buildPageUrl={buildPageUrl}
                handlePageChange={handlePageChange}
              >
                {page}
              </PageButton>
            )
          )}
        </div>

        {/* Next button */}
        <PageButton
          page={currentPage + 1}
          disabled={!canGoNext}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          ariaLabel="Next page"
          baseUrl={baseUrl}
          buildPageUrl={buildPageUrl}
          handlePageChange={handlePageChange}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </PageButton>
      </div>
    </div>
  );
}
