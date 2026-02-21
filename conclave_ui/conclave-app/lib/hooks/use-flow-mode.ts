"use client";

import { useState, useCallback } from "react";
import type { FlowMode } from "@/components/flows/mode-selector";

// =============================================================================
// Constants
// =============================================================================

const MODE_STORAGE_KEY = "conclave-preferred-flow-mode";

// =============================================================================
// Hook: useFlowModePreference
// =============================================================================

/**
 * Hook for persisting user's preferred flow mode in localStorage.
 *
 * Returns:
 * - preference: The stored mode preference (null if first-time user)
 * - savePreference: Function to save a new preference
 * - clearPreference: Function to clear the stored preference
 * - isFirstTime: Whether this is a first-time user (no preference stored)
 */
export function useFlowModePreference() {
  const [preference, setPreference] = useState<FlowMode | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === "basic" || stored === "advanced") {
        return stored;
      }
    } catch {
      // localStorage not available (SSR or privacy mode)
    }
    return null;
  });
  const [isLoaded] = useState(true);

  // Save preference to localStorage
  const savePreference = useCallback((mode: FlowMode) => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
      setPreference(mode);
    } catch {
      // localStorage not available
    }
  }, []);

  // Clear preference from localStorage
  const clearPreference = useCallback(() => {
    try {
      localStorage.removeItem(MODE_STORAGE_KEY);
      setPreference(null);
    } catch {
      // localStorage not available
    }
  }, []);

  return {
    preference,
    savePreference,
    clearPreference,
    isFirstTime: isLoaded && preference === null,
    isLoaded,
  };
}
