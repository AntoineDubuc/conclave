"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Sparkles, Code, Gift } from "lucide-react";
import { ProviderCard, ModelId, AVAILABLE_MODELS } from "./model-card";
import {
  ProviderId,
  PROVIDER_LIST,
  PREMIUM_PROVIDERS,
  OPEN_SOURCE_PROVIDERS,
  OTHER_PROVIDERS,
  TIERED_PROVIDER_LIST,
  MODELS_BY_PROVIDER,
  getDefaultModel,
  type ModelTier,
} from "@/lib/models";

export type FlowType = "round-robin" | "hub-spoke";

export interface ModelSelection {
  providerId: ProviderId;
  modelId: string;
}

interface ModelPickerProps {
  flowType?: FlowType;
  selectedProviders?: ModelSelection[];
  onSelectionChange?: (selections: ModelSelection[]) => void;
  minModels?: number;
  className?: string;
}

/**
 * Provider selection grid for choosing AI providers and models in a flow.
 *
 * Features:
 * - Displays providers in a responsive grid
 * - Each provider has a dropdown to select specific model
 * - Supports selection with provider-specific colored borders
 * - For Hub-Spoke flow: first selected provider becomes the leader
 * - Shows validation message when minimum providers not met
 */
export function ModelPicker({
  flowType = "round-robin",
  selectedProviders: controlledSelected,
  onSelectionChange,
  minModels = 2,
  className,
}: ModelPickerProps) {
  // Support both controlled and uncontrolled usage
  const [internalSelected, setInternalSelected] = useState<ModelSelection[]>([]);
  const selectedProviders = controlledSelected ?? internalSelected;

  const handleToggle = useCallback(
    (providerId: ProviderId) => {
      const existingIndex = selectedProviders.findIndex((s) => s.providerId === providerId);
      let newSelected: ModelSelection[];

      if (existingIndex >= 0) {
        // Remove this provider
        newSelected = selectedProviders.filter((s) => s.providerId !== providerId);
      } else {
        // Add this provider with its default model
        const defaultModel = getDefaultModel(providerId);
        newSelected = [
          ...selectedProviders,
          {
            providerId,
            modelId: defaultModel?.id || "",
          },
        ];
      }

      if (onSelectionChange) {
        onSelectionChange(newSelected);
      } else {
        setInternalSelected(newSelected);
      }
    },
    [selectedProviders, onSelectionChange]
  );

  const handleModelChange = useCallback(
    (providerId: ProviderId, modelId: string) => {
      const newSelected = selectedProviders.map((s) =>
        s.providerId === providerId ? { ...s, modelId } : s
      );

      // If this provider wasn't selected yet, add it
      if (!selectedProviders.find((s) => s.providerId === providerId)) {
        newSelected.push({ providerId, modelId });
      }

      if (onSelectionChange) {
        onSelectionChange(newSelected);
      } else {
        setInternalSelected(newSelected);
      }
    },
    [selectedProviders, onSelectionChange]
  );

  const isValid = selectedProviders.length >= minModels;
  const leaderId = flowType === "hub-spoke" ? selectedProviders[0]?.providerId : undefined;

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Select Providers</h2>
          <p className="text-sm text-white/60 mt-1">
            Choose at least {minModels} providers and select models for each
            {flowType === "hub-spoke" && (
              <span className="text-purple-400">
                {" "}
                (first selected will be the leader)
              </span>
            )}
          </p>
        </div>
        <div className="text-sm text-white/60">
          {selectedProviders.length} selected
        </div>
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PROVIDER_LIST.map((providerId) => {
          const selection = selectedProviders.find((s) => s.providerId === providerId);
          return (
            <ProviderCard
              key={providerId}
              providerId={providerId}
              isSelected={!!selection}
              isLeader={providerId === leaderId}
              selectedModelId={selection?.modelId}
              onToggle={handleToggle}
              onModelChange={handleModelChange}
            />
          );
        })}
      </div>

      {/* Validation message */}
      {!isValid && selectedProviders.length > 0 && (
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            Please select at least {minModels} providers to continue
          </span>
        </div>
      )}

      {!isValid && selectedProviders.length === 0 && (
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Select {minModels} or more providers to start a conversation
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tier Section Configuration
// =============================================================================

interface TierSection {
  id: ModelTier;
  title: string;
  subtitle: string;
  providers: ProviderId[];
  icon: React.ComponentType<{ className?: string }>;
  defaultExpanded: boolean;
  badgeColor: string;
}

const TIER_SECTIONS: TierSection[] = [
  {
    id: "premium",
    title: "Top Providers",
    subtitle: "Direct API access to premium models",
    providers: PREMIUM_PROVIDERS,
    icon: Sparkles,
    defaultExpanded: true,
    badgeColor: "text-amber-400",
  },
  {
    id: "open-source",
    title: "Open Source",
    subtitle: "Cost-effective alternatives via OpenRouter",
    providers: [...OPEN_SOURCE_PROVIDERS, ...OTHER_PROVIDERS].filter(
      (p) => MODELS_BY_PROVIDER[p]?.length > 0
    ),
    icon: Code,
    defaultExpanded: false,
    badgeColor: "text-blue-400",
  },
];

// Get free models from any provider for the free tier section
const getFreeProviders = (): ProviderId[] => {
  const freeProviders: ProviderId[] = [];
  for (const providerId of TIERED_PROVIDER_LIST) {
    const hasFreeTier = MODELS_BY_PROVIDER[providerId]?.some(
      (m) => m.tier === "free"
    );
    if (hasFreeTier) {
      freeProviders.push(providerId);
    }
  }
  return freeProviders;
};

// Add free tier section dynamically
const FREE_TIER_SECTION: TierSection = {
  id: "free",
  title: "Free Tier",
  subtitle: "Free models with rate limits (20 req/min)",
  providers: getFreeProviders(),
  icon: Gift,
  defaultExpanded: false,
  badgeColor: "text-green-400",
};

// =============================================================================
// Tier Section Component
// =============================================================================

interface TierSectionProps {
  section: TierSection;
  isExpanded: boolean;
  onToggleExpand: () => void;
  selectedProviders: ModelSelection[];
  leaderId?: ProviderId;
  onToggle: (providerId: ProviderId) => void;
  onModelChange: (providerId: ProviderId, modelId: string) => void;
  filterFreeTier?: boolean;
}

function TierSectionComponent({
  section,
  isExpanded,
  onToggleExpand,
  selectedProviders,
  leaderId,
  onToggle,
  onModelChange,
  filterFreeTier = false,
}: TierSectionProps) {
  const Icon = section.icon;
  const selectedInSection = selectedProviders.filter((s) =>
    section.providers.includes(s.providerId)
  );

  // Skip rendering if no providers with models
  if (section.providers.length === 0) {
    return null;
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
      {/* Section Header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-white/40" />
          ) : (
            <ChevronRight className="w-5 h-5 text-white/40" />
          )}
          <Icon className={`w-5 h-5 ${section.badgeColor}`} />
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">{section.title}</h3>
            <p className="text-xs text-white/50">{section.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedInSection.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full bg-white/10 ${section.badgeColor}`}>
              {selectedInSection.length} selected
            </span>
          )}
          <span className="text-xs text-white/40">
            {section.providers.length} providers
          </span>
        </div>
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.providers.map((providerId) => {
              const selection = selectedProviders.find(
                (s) => s.providerId === providerId
              );
              return (
                <ProviderCard
                  key={providerId}
                  providerId={providerId}
                  isSelected={!!selection}
                  isLeader={providerId === leaderId}
                  selectedModelId={selection?.modelId}
                  onToggle={onToggle}
                  onModelChange={onModelChange}
                  showTierBadge={section.id !== "premium"}
                  filterFreeTier={filterFreeTier && section.id === "free"}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tiered Model Picker
// =============================================================================

interface TieredModelPickerProps {
  flowType?: FlowType;
  selectedProviders?: ModelSelection[];
  onSelectionChange?: (selections: ModelSelection[]) => void;
  minModels?: number;
  className?: string;
  showFreeTier?: boolean;
}

/**
 * Tiered provider selection with collapsible sections.
 *
 * Features:
 * - Groups providers into Premium, Open Source, and Free tiers
 * - Collapsible sections (Premium expanded by default)
 * - Shows tier badges on provider cards
 * - Supports both controlled and uncontrolled usage
 */
export function TieredModelPicker({
  flowType = "round-robin",
  selectedProviders: controlledSelected,
  onSelectionChange,
  minModels = 2,
  className,
  showFreeTier = true,
}: TieredModelPickerProps) {
  // Support both controlled and uncontrolled usage
  const [internalSelected, setInternalSelected] = useState<ModelSelection[]>([]);
  const selectedProviders = controlledSelected ?? internalSelected;

  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<ModelTier>>(
    new Set(["premium"])
  );

  const toggleSection = useCallback((tier: ModelTier) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  }, []);

  const handleToggle = useCallback(
    (providerId: ProviderId) => {
      const existingIndex = selectedProviders.findIndex(
        (s) => s.providerId === providerId
      );
      let newSelected: ModelSelection[];

      if (existingIndex >= 0) {
        newSelected = selectedProviders.filter(
          (s) => s.providerId !== providerId
        );
      } else {
        const defaultModel = getDefaultModel(providerId);
        newSelected = [
          ...selectedProviders,
          {
            providerId,
            modelId: defaultModel?.id || "",
          },
        ];
      }

      if (onSelectionChange) {
        onSelectionChange(newSelected);
      } else {
        setInternalSelected(newSelected);
      }
    },
    [selectedProviders, onSelectionChange]
  );

  const handleModelChange = useCallback(
    (providerId: ProviderId, modelId: string) => {
      const newSelected = selectedProviders.map((s) =>
        s.providerId === providerId ? { ...s, modelId } : s
      );

      if (!selectedProviders.find((s) => s.providerId === providerId)) {
        newSelected.push({ providerId, modelId });
      }

      if (onSelectionChange) {
        onSelectionChange(newSelected);
      } else {
        setInternalSelected(newSelected);
      }
    },
    [selectedProviders, onSelectionChange]
  );

  const isValid = selectedProviders.length >= minModels;
  const leaderId =
    flowType === "hub-spoke" ? selectedProviders[0]?.providerId : undefined;

  // Build sections list
  const sections = showFreeTier && FREE_TIER_SECTION.providers.length > 0
    ? [...TIER_SECTIONS, FREE_TIER_SECTION]
    : TIER_SECTIONS;

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Select Models</h2>
          <p className="text-sm text-white/60 mt-1">
            Choose at least {minModels} models from any tier
            {flowType === "hub-spoke" && (
              <span className="text-purple-400">
                {" "}
                (first selected will be the leader)
              </span>
            )}
          </p>
        </div>
        <div className="text-sm text-white/60">
          {selectedProviders.length} selected
        </div>
      </div>

      {/* Tier sections */}
      <div className="space-y-3">
        {sections.map((section) => (
          <TierSectionComponent
            key={section.id}
            section={section}
            isExpanded={expandedSections.has(section.id)}
            onToggleExpand={() => toggleSection(section.id)}
            selectedProviders={selectedProviders}
            leaderId={leaderId}
            onToggle={handleToggle}
            onModelChange={handleModelChange}
            filterFreeTier={section.id === "free"}
          />
        ))}
      </div>

      {/* Validation message */}
      {!isValid && selectedProviders.length > 0 && (
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>Please select at least {minModels} models to continue</span>
        </div>
      )}

      {!isValid && selectedProviders.length === 0 && (
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Select {minModels} or more models to start a conversation
          </span>
        </div>
      )}
    </div>
  );
}

// Re-export types for convenience
export type { ProviderId, ModelSelection as ProviderModelSelection };
export { PROVIDER_LIST, TIERED_PROVIDER_LIST };

// Legacy exports for backwards compatibility
export type { ModelId };
export { AVAILABLE_MODELS };
