/**
 * Unified Flow Wizard - New Flow Entry Point
 *
 * Entry: Choice (Use Existing / Create New)
 * - Use Existing: Flow Type → Mode (Basic/Advanced) → Models → [Discovery] → Configure → Results
 * - Create New: Redirects to /flows/new/chat (Flow Architect)
 */

"use client";

import { useState, useCallback, useMemo, useRef, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Play,
  Settings2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Flow components
import { FlowEntrySelector, type FlowEntryChoice } from "@/components/flows/flow-entry-choice";
import { DynamicFlowSelector } from "@/components/flows/dynamic-flow-selector";
import { FlowType } from "@/components/flows/flow-type-card";
import { isBuiltInPattern, type SelectableFlow, type BuiltInPatternId } from "@/lib/types/flow";
import { TieredModelPicker, type ModelSelection } from "@/components/flows/model-picker";
import { TaskInput } from "@/components/flows/task-input";
import { CostEstimator, type FlowModelConfig } from "@/components/flows/cost-estimator";
import { ResultsDisplay, type ResponseData, type SynthesisData } from "@/components/flows/results-display";
import { ResultsActions } from "@/components/flows/results-actions";
import {
  ModeSelector,
  type FlowMode,
  DiscoveryChat,
  type DiscoveryContinueData,
  SystemPromptEditor,
  LLMSettingsPanel,
  ResultEditor,
  IterationControls,
  exportTurnsAsMarkdown,
  exportTurnsAsJSON,
  type AgentResult,
  type Turn,
} from "@/components/flows";

// Utilities
import { getModelById, PROVIDERS } from "@/lib/models";
import type { AgentConfig, LLMSettings, PresetName } from "@/lib/types/llm-settings";
import { buildAgentConfigsFromSelection } from "@/lib/flows/defaults";
import { applyPreset } from "@/lib/types/llm-settings";
import { flowToasts } from "@/lib/errors/toast";
import { getErrorMessage } from "@/lib/errors/messages";
import { useFlowModePreference } from "@/lib/hooks/use-flow-mode";

// =============================================================================
// Types
// =============================================================================

interface ParticipantResult {
  output: string;
  error?: string;
  cost: number;
  execution_time_seconds: number;
}

interface PhaseResult {
  name: string;
  type: "single" | "parallel" | "sequential";
  results: Record<string, ParticipantResult>;
  execution_time_seconds: number;
  error?: string;
}

interface ExecuteResponse {
  execution_id: string;
  status: "complete" | "partial" | "failed" | "cancelled";
  phases: PhaseResult[];
  total_cost: number;
  execution_time_seconds: number;
  error?: string;
  run_id?: string;
}

type WizardStep =
  | "choice"
  | "flow-type"
  | "mode"
  | "models"
  | "discovery"
  | "configure"
  | "results";

// =============================================================================
// Step Configuration
// =============================================================================

// New flow: choice → flow-type → mode → models → configure → results
const BASIC_STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: "choice", label: "Start", number: 0 },
  { id: "flow-type", label: "Flow Type", number: 1 },
  { id: "mode", label: "Mode", number: 2 },
  { id: "models", label: "Models", number: 3 },
  { id: "configure", label: "Task", number: 4 },
  { id: "results", label: "Results", number: 5 },
];

// New flow: choice → flow-type → mode → models → discovery → configure → results
const ADVANCED_STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: "choice", label: "Start", number: 0 },
  { id: "flow-type", label: "Flow Type", number: 1 },
  { id: "mode", label: "Mode", number: 2 },
  { id: "models", label: "Models", number: 3 },
  { id: "discovery", label: "Discover", number: 4 },
  { id: "configure", label: "Configure", number: 5 },
  { id: "results", label: "Results", number: 6 },
];

// =============================================================================
// Loading Skeleton
// =============================================================================

function NewFlowSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-indigo-500/40 via-purple-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-500/30 via-blue-500/20 to-transparent rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-5xl mx-auto py-12 px-6">
        <div className="animate-pulse">
          <div className="h-4 w-32 bg-white/10 rounded mb-6" />
          <div className="h-12 w-80 bg-white/10 rounded mb-4" />
          <div className="h-6 w-96 bg-white/10 rounded mb-12" />
          <div className="h-64 bg-white/5 rounded-3xl border border-white/10" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component (with Suspense boundary)
// =============================================================================

export default function NewFlowPage() {
  return (
    <Suspense fallback={<NewFlowSkeleton />}>
      <NewFlowWizard />
    </Suspense>
  );
}

// =============================================================================
// Wizard Component
// =============================================================================

function NewFlowWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const stepParam = searchParams.get("step");
  const { preference, savePreference, isFirstTime, isLoaded } = useFlowModePreference();

  // Initialize mode from URL param or saved preference
  const [mode, setMode] = useState<FlowMode | null>(() => {
    if (modeParam === "basic" || modeParam === "advanced") {
      return modeParam;
    }
    return null;
  });

  // Track if user chose "use existing flow" (used for UI state tracking, not rendered directly)
  const [_entryChoice, setEntryChoice] = useState<FlowEntryChoice | null>(() => {
    // If mode is already set via URL, they're using existing flow
    if (modeParam === "basic" || modeParam === "advanced") {
      return "existing";
    }
    // If step param indicates further progress, they chose existing
    if (stepParam === "flow-type" || stepParam === "mode" || stepParam === "models") {
      return "existing";
    }
    return null;
  });

  // Initialize step based on URL params
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    // If mode is set, start at models step
    if (modeParam === "basic" || modeParam === "advanced") {
      return "models";
    }
    // If step param is set, use it
    if (stepParam === "flow-type" || stepParam === "mode" || stepParam === "models") {
      return stepParam as WizardStep;
    }
    // Default to choice step
    return "choice";
  });

  // Flow configuration state
  const [selectedType, setSelectedType] = useState<FlowType | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<ModelSelection[]>([]);
  const [taskText, setTaskText] = useState("");
  const [discoveryTranscript, setDiscoveryTranscript] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Agent configuration state (Advanced mode)
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [defaultPrompts, setDefaultPrompts] = useState<Record<string, string>>({});

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const isExecutingRef = useRef(false); // Ref-based guard for synchronous check
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [results, setResults] = useState<ExecuteResponse | null>(null);

  // Iteration state (Advanced mode)
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentTurnNumber, setCurrentTurnNumber] = useState(1);

  // UI state (Advanced mode)
  const [configTab, setConfigTab] = useState<"task" | "prompts" | "settings">("task");

  // Derived state
  const leaderProviderId = selectedType === "hub-spoke" ? selectedModels[0]?.providerId : undefined;
  const activeSteps = mode === "advanced" ? ADVANCED_STEPS : BASIC_STEPS;
  const currentStepIndex = activeSteps.findIndex((s) => s.id === currentStep);

  // Validation
  const canProceedFromFlowType = selectedType !== null && selectedFlowId !== null;
  const canProceedFromModels = selectedModels.length >= 2;
  const canProceedFromConfigure = taskText.trim().length > 0;

  // Apply saved preference on load (if no URL param)
  // This effect runs after hydration to avoid SSR mismatch
  useEffect(() => {
    if (isLoaded && preference && !modeParam && currentStep === "mode") {
      setMode(preference);
      setCurrentStep("flow-type");
    }
  }, [isLoaded, preference, modeParam, currentStep]);

  // ==========================================================================
  // Entry choice handler (Use Existing / Create New)
  // ==========================================================================

  const handleEntryChoice = useCallback(
    (choice: FlowEntryChoice) => {
      setEntryChoice(choice);
      if (choice === "existing") {
        setCurrentStep("flow-type");
        router.push("/flows/new?step=flow-type", { scroll: false });
      }
      // "create" choice is handled in the component itself (navigates to /flows/new/chat)
    },
    [router]
  );

  // ==========================================================================
  // Mode selection handler (now comes after flow-type)
  // ==========================================================================

  const handleModeSelect = useCallback(
    (newMode: FlowMode) => {
      setMode(newMode);
      savePreference(newMode);
      setCurrentStep("models");
      router.push(`/flows/new?mode=${newMode}`, { scroll: false });
    },
    [router, savePreference]
  );

  const handleChangeMode = useCallback(() => {
    setMode(null);
    setCurrentStep("mode");
    router.push("/flows/new?step=mode", { scroll: false });
  }, [router]);

  const handleChangeFlowType = useCallback(() => {
    setSelectedType(null);
    setSelectedFlowId(null);
    setMode(null);
    setCurrentStep("flow-type");
    router.push("/flows/new?step=flow-type", { scroll: false });
  }, [router]);

  const handleFlowSelect = useCallback(
    (flow: SelectableFlow) => {
      if (isBuiltInPattern(flow)) {
        setSelectedType(flow.id as FlowType);
        setSelectedFlowId(flow.id);
      } else {
        // Custom flow - use round-robin as default type, proceed through wizard
        setSelectedType("round-robin");
        setSelectedFlowId(flow.id);
      }
    },
    []
  );

  const handleCreateNewFlow = useCallback(() => {
    router.push("/flows/new/chat");
  }, [router]);

  // ==========================================================================
  // Initialize agent configs when models change (Advanced mode)
  // ==========================================================================

  const initializeAgentConfigs = useCallback(() => {
    if (selectedModels.length < 2 || !selectedType) return;

    const configs = buildAgentConfigsFromSelection(selectedModels, selectedType, leaderProviderId);
    setAgentConfigs(configs);

    const defaults: Record<string, string> = {};
    for (const config of configs) {
      defaults[config.id] = config.systemPrompt;
    }
    setDefaultPrompts(defaults);
  }, [selectedModels, selectedType, leaderProviderId]);

  // ==========================================================================
  // Navigation handlers
  // ==========================================================================

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
    setExecutionError(null);
  }, []);

  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeSteps.length) {
      goToStep(activeSteps[nextIndex].id);
    }
  }, [currentStepIndex, activeSteps, goToStep]);

  const goToPrevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(activeSteps[prevIndex].id);
    }
  }, [currentStepIndex, activeSteps, goToStep]);

  const handleContinueFromModels = useCallback(() => {
    if (canProceedFromModels) {
      if (mode === "advanced") {
        initializeAgentConfigs();
      }
      goToNextStep();
    }
  }, [canProceedFromModels, mode, initializeAgentConfigs, goToNextStep]);

  const synthesizeTask = useCallback(async (
    transcript: string,
    modelId: string,
    provider: string,
  ) => {
    setIsSynthesizing(true);
    try {
      const response = await fetch("/api/chat/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, model: modelId, provider }),
      });

      if (!response.ok) {
        console.warn("Synthesis failed:", response.status);
        return;
      }

      const data = await response.json();
      if (data.task) {
        // Only set if user hasn't started typing
        setTaskText((current) => current.trim() ? current : data.task);
      }
    } catch (err) {
      console.warn("Synthesis error:", err);
    } finally {
      setIsSynthesizing(false);
    }
  }, []);

  const handleDiscoveryContinue = useCallback(
    (data: DiscoveryContinueData) => {
      setDiscoveryTranscript(data.transcript);
      goToNextStep();
      synthesizeTask(data.transcript, data.modelId, data.provider);
    },
    [goToNextStep, synthesizeTask]
  );

  const handleDiscoverySkip = useCallback(() => {
    goToNextStep();
  }, [goToNextStep]);

  // ==========================================================================
  // Agent config handlers (Advanced mode)
  // ==========================================================================

  const handleUpdateSystemPrompt = useCallback((agentId: string, prompt: string) => {
    setAgentConfigs((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, systemPrompt: prompt } : a))
    );
  }, []);

  const handleResetSystemPrompt = useCallback(
    (agentId: string) => {
      const defaultPrompt = defaultPrompts[agentId];
      if (defaultPrompt) {
        handleUpdateSystemPrompt(agentId, defaultPrompt);
      }
    },
    [defaultPrompts, handleUpdateSystemPrompt]
  );

  const handleUpdateSettings = useCallback((agentId: string, settings: LLMSettings) => {
    setAgentConfigs((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, settings } : a))
    );
  }, []);

  const handleApplyPresetToAll = useCallback((preset: PresetName) => {
    setAgentConfigs((prev) =>
      prev.map((a) => ({
        ...a,
        settings: applyPreset(a.settings, preset, a.provider),
      }))
    );
  }, []);

  // ==========================================================================
  // Execution handlers
  // ==========================================================================

  const handleRunFlow = useCallback(async () => {
    // Guard: Check ref FIRST (synchronous) to prevent race condition on double-click
    if (isExecutingRef.current || isExecuting) {
      return;
    }
    if (!selectedType || selectedModels.length < 2 || !taskText.trim()) {
      return;
    }

    isExecutingRef.current = true;
    setIsExecuting(true);
    setExecutionError(null);

    try {
      // Build request payload
      const modelIdsForApi = selectedModels.map((s) => s.modelId);

      const payload: Record<string, unknown> = {
        flow_type: selectedType,
        models: modelIdsForApi,
        task: taskText,
        leader_id: leaderProviderId,
        model_selections: selectedModels.map((s) => ({
          provider_id: s.providerId,
          model_id: s.modelId,
        })),
      };

      // Add advanced mode data
      if (mode === "advanced") {
        const systemPrompts: Record<string, string> = {};
        const llmSettings: Record<string, LLMSettings> = {};

        for (const config of agentConfigs) {
          systemPrompts[config.id] = config.systemPrompt;
          llmSettings[config.id] = config.settings;
        }

        payload.system_prompts = systemPrompts;
        payload.llm_settings = llmSettings;
        payload.discovery_context = discoveryTranscript || undefined;

        // Add previous results for iteration
        if (currentTurnNumber > 1) {
          payload.previous_results = agentResults
            .filter((r) => r.isEdited)
            .map((r) => ({
              agentId: r.agentId,
              agentName: r.agentName,
              content: r.editedContent,
            }));
        }
      }

      const response = await fetch("/api/flows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorWithStatus = { status: response.status, message: data.message };
        flowToasts.executionFailed(errorWithStatus);
        throw new Error(getErrorMessage(errorWithStatus).message);
      }

      flowToasts.executionSuccess(data.total_cost);
      setResults(data);

      // Transform results for Advanced mode
      if (mode === "advanced") {
        const lastPhase = data.phases[data.phases.length - 1];
        const newAgentResults: AgentResult[] = [];

        for (const [agentId, result] of Object.entries(lastPhase.results)) {
          const selection = selectedModels.find((s) => s.providerId === agentId);
          const modelInfo = selection ? getModelById(selection.modelId) : null;
          const content = (result as ParticipantResult).output || "";

          newAgentResults.push({
            agentId,
            agentName: modelInfo?.name || agentId,
            provider: selection?.providerId || "unknown",
            role: agentId === leaderProviderId ? "leader" : "contributor",
            originalContent: content,
            editedContent: content,
            isEdited: false,
          });
        }

        setAgentResults(newAgentResults);

        // Record turn in history
        const turn: Turn = {
          turnNumber: currentTurnNumber,
          timestamp: new Date(),
          results: newAgentResults.map((r) => ({
            agentId: r.agentId,
            agentName: r.agentName,
            content: r.originalContent,
          })),
          editedAgentIds: [],
        };
        setTurns((prev) => [...prev, turn]);
      }

      goToStep("results");
    } catch (error) {
      console.error("Flow execution error:", error);
      setExecutionError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsExecuting(false);
      isExecutingRef.current = false; // Release guard
    }
  }, [
    isExecuting,
    selectedType,
    selectedModels,
    taskText,
    leaderProviderId,
    mode,
    agentConfigs,
    discoveryTranscript,
    currentTurnNumber,
    agentResults,
    goToStep,
  ]);

  // ==========================================================================
  // Result editing handlers (Advanced mode)
  // ==========================================================================

  const handleUpdateResult = useCallback((agentId: string, content: string) => {
    setAgentResults((prev) =>
      prev.map((r) =>
        r.agentId === agentId
          ? { ...r, editedContent: content, isEdited: content !== r.originalContent }
          : r
      )
    );
  }, []);

  const handleResetResult = useCallback((agentId: string) => {
    setAgentResults((prev) =>
      prev.map((r) =>
        r.agentId === agentId
          ? { ...r, editedContent: r.originalContent, isEdited: false }
          : r
      )
    );
  }, []);

  const handleResetAllResults = useCallback(() => {
    setAgentResults((prev) =>
      prev.map((r) => ({ ...r, editedContent: r.originalContent, isEdited: false }))
    );
  }, []);

  // ==========================================================================
  // Iteration handlers (Advanced mode)
  // ==========================================================================

  const hasEdits = useMemo(() => agentResults.some((r) => r.isEdited), [agentResults]);

  const handleRunAnotherTurn = useCallback(async () => {
    // Guard: Prevent duplicate execution via ref check
    if (isExecutingRef.current || isExecuting) {
      return;
    }

    const editedIds = agentResults.filter((r) => r.isEdited).map((r) => r.agentId);
    setTurns((prev) =>
      prev.map((t, i) => (i === prev.length - 1 ? { ...t, editedAgentIds: editedIds } : t))
    );

    setCurrentTurnNumber((n) => n + 1);
    await handleRunFlow();
  }, [agentResults, handleRunFlow, isExecuting]);

  const handleExport = useCallback(
    (format: "markdown" | "json") => {
      const content = format === "markdown" ? exportTurnsAsMarkdown(turns) : exportTurnsAsJSON(turns);

      const blob = new Blob([content], {
        type: format === "markdown" ? "text/markdown" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flow-history.${format === "markdown" ? "md" : "json"}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [turns]
  );

  // ==========================================================================
  // Results data transformers (Basic mode)
  // ==========================================================================

  const getResponseData = useCallback((): ResponseData[] => {
    if (!results) return [];

    const responses: ResponseData[] = [];
    const lastPhase = results.phases[results.phases.length - 1];

    for (const [agentId, result] of Object.entries(lastPhase.results)) {
      const selection = selectedModels.find((s) => s.providerId === agentId);
      const modelInfo = selection ? getModelById(selection.modelId) : null;

      responses.push({
        modelId: agentId,
        modelName: modelInfo?.name || agentId,
        provider: selection?.providerId || "unknown",
        content: result.output || "",
        tokenCount: Math.ceil((result.output?.length || 0) / 4),
        duration: result.execution_time_seconds,
        cost: result.cost,
      });
    }

    return responses;
  }, [results, selectedModels]);

  const getSynthesisData = useCallback((): SynthesisData | undefined => {
    if (!results || selectedType !== "hub-spoke") return undefined;

    const synthesisPhase = results.phases.find((p) => p.name === "Leader Synthesis");
    if (!synthesisPhase || !leaderProviderId) return undefined;

    const leaderResult = synthesisPhase.results[leaderProviderId];
    if (!leaderResult) return undefined;

    return {
      content: leaderResult.output,
      tokenCount: Math.ceil(leaderResult.output.length / 4),
      duration: leaderResult.execution_time_seconds,
      cost: leaderResult.cost,
    };
  }, [results, selectedType, leaderProviderId]);

  const getModelsInfo = useCallback(() => {
    return selectedModels.map((selection) => {
      const modelInfo = getModelById(selection.modelId);
      const provider = PROVIDERS[selection.providerId];
      return {
        id: selection.providerId,
        name: modelInfo?.name || selection.providerId,
        provider: selection.providerId,
        isLeader: selection.providerId === leaderProviderId,
        color: provider?.color || "#888",
      };
    });
  }, [selectedModels, leaderProviderId]);

  const getFlowDataForExport = useCallback(() => {
    return {
      id: results?.run_id || results?.execution_id || "unknown",
      flowType: selectedType || "round-robin",
      task: taskText,
      responses: getResponseData().map((r) => ({
        modelName: r.modelName,
        content: r.content,
      })),
      synthesis: getSynthesisData() ? { content: getSynthesisData()!.content } : undefined,
    };
  }, [results, selectedType, taskText, getResponseData, getSynthesisData]);

  // ==========================================================================
  // Cost estimator config
  // ==========================================================================

  const flowModelConfigs: FlowModelConfig[] = selectedModels.map((selection) => ({
    modelId: selection.modelId,
    isLeader: selection.providerId === leaderProviderId,
  }));

  // ==========================================================================
  // Reset handler
  // ==========================================================================

  const handleStartNewFlow = useCallback(() => {
    setCurrentStep("choice");
    setEntryChoice(null);
    setMode(null);
    setSelectedType(null);
    setSelectedModels([]);
    setTaskText("");
    setResults(null);
    setExecutionError(null);
    setAgentConfigs([]);
    setAgentResults([]);
    setTurns([]);
    setCurrentTurnNumber(1);
    router.push("/flows/new", { scroll: false });
  }, [router]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-indigo-500/40 via-purple-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-500/30 via-blue-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-gradient-to-r from-pink-500/20 to-orange-500/20 rounded-full blur-3xl" />
      </div>
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto py-12 px-6">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-sm text-white/60 mb-4">
            <button
              type="button"
              onClick={() => router.push("/flows")}
              className="hover:text-white transition-colors"
            >
              Flows
            </button>
            <span>/</span>
            <span className="text-white">New Flow</span>
            {selectedType && currentStep !== "choice" && currentStep !== "flow-type" && (
              <>
                <span className="text-white/40 mx-2">|</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                  {selectedType === "round-robin" ? "Round-Robin" : "Hub-and-Spoke"}
                </span>
                <button
                  type="button"
                  onClick={handleChangeFlowType}
                  className="text-xs text-white/40 hover:text-white/60 transition-colors ml-1"
                >
                  (change)
                </button>
              </>
            )}
            {mode && (
              <>
                <span className="text-white/40 mx-2">|</span>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    mode === "basic"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-purple-500/20 text-purple-400"
                  )}
                >
                  {mode === "basic" ? "Basic" : "Advanced"}
                </span>
                {currentStep !== "mode" && currentStep !== "choice" && currentStep !== "flow-type" && (
                  <button
                    type="button"
                    onClick={handleChangeMode}
                    className="text-xs text-white/40 hover:text-white/60 transition-colors ml-1"
                  >
                    (change)
                  </button>
                )}
              </>
            )}
          </nav>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            {currentStep === "results"
              ? "Flow Results"
              : currentStep === "choice"
                ? "New Flow"
                : currentStep === "flow-type"
                  ? "Select a Flow"
                  : currentStep === "mode"
                    ? "Choose Your Experience"
                    : selectedType === "round-robin"
                      ? "Round-Robin Flow"
                      : selectedType === "hub-spoke"
                        ? "Hub-and-Spoke Flow"
                        : mode === "advanced"
                          ? "Advanced Flow Builder"
                          : "Quick Flow Builder"}
          </h1>
          <p className="text-white/50">
            {currentStep === "results"
              ? "Review the responses from your multi-model collaboration."
              : currentStep === "choice"
                ? "Start with an existing flow or create something entirely new."
                : currentStep === "flow-type"
                  ? "Choose a pre-built flow pattern or select from your saved flows."
                  : currentStep === "mode"
                    ? "Choose how you want to configure and run this flow."
                    : selectedType === "round-robin"
                      ? "Get diverse perspectives from multiple AI models collaborating on your task."
                      : selectedType === "hub-spoke"
                        ? "A leader model synthesizes contributions from all participants."
                        : mode === "advanced"
                          ? "Configure, execute, review, edit, and iterate on your flow."
                          : "Set up and run your flow with smart defaults."}
          </p>
        </div>

        {/* Step Indicator - hidden on choice step */}
        {currentStep !== "choice" && (
          <div className="mb-8">
            <div className="flex items-center gap-4">
              {activeSteps.slice(1).map((step, i) => (
                <div key={step.id} className="flex items-center gap-4 flex-1 last:flex-none">
                  <StepIndicator
                    step={step.number}
                    label={step.label}
                    isActive={currentStepIndex >= i + 1}
                    isCurrent={currentStep === step.id}
                  />
                  {i < activeSteps.length - 2 && (
                    <div
                      className={cn(
                        "flex-1 h-px",
                        currentStepIndex > i + 1 ? "bg-purple-500/50" : "bg-white/10"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          {/* Step: Entry Choice (Use Existing / Create New) */}
          {currentStep === "choice" && (
            <div className="p-8">
              <FlowEntrySelector onSelect={handleEntryChoice} />
            </div>
          )}

          {/* Step: Flow Type (comes before mode now) */}
          {currentStep === "flow-type" && (
            <div className="p-8">
              <DynamicFlowSelector
                selectedId={selectedFlowId}
                onSelect={handleFlowSelect}
                onCreateNew={handleCreateNewFlow}
              />
            </div>
          )}

          {/* Step: Mode Selection (Basic/Advanced - comes after flow type) */}
          {currentStep === "mode" && (
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  How would you like to configure this flow?
                </h2>
                <p className="text-white/60">
                  Choose the experience level that fits your needs
                </p>
              </div>
              <ModeSelector
                selectedMode={mode}
                onSelect={handleModeSelect}
                showHint={isFirstTime}
              />
            </div>
          )}

          {/* Step: Models */}
          {currentStep === "models" && (
            <div className="p-8">
              <TieredModelPicker
                flowType={selectedType || "round-robin"}
                selectedProviders={selectedModels}
                onSelectionChange={setSelectedModels}
                minModels={2}
                showFreeTier={true}
              />
            </div>
          )}

          {/* Step: Discovery (Advanced only) */}
          {currentStep === "discovery" && mode === "advanced" && (
            <div className="h-[600px]">
              <DiscoveryChat
                onContinue={handleDiscoveryContinue}
                onSkip={handleDiscoverySkip}
                flowType={selectedType || undefined}
              />
            </div>
          )}

          {/* Step: Configure */}
          {currentStep === "configure" && (
            <div className="p-8">
              {mode === "basic" ? (
                // Basic mode: just task + cost
                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="relative">
                      <TaskInput
                        value={taskText}
                        onChange={setTaskText}
                        isRunning={isExecuting}
                        disabled={isSynthesizing || !canProceedFromConfigure}
                      />
                      {isSynthesizing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
                          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/10 border border-white/10">
                            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                            <span className="text-sm text-white/80">Synthesizing your discoveries...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <CostEstimator
                      flowType={selectedType || "round-robin"}
                      models={flowModelConfigs}
                      promptText={taskText}
                      balance={50}
                      lifetimeSpend={0}
                      billingType="managed"
                    />
                  </div>

                  {/* Error display */}
                  {executionError && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-medium text-red-400">Execution Failed</p>
                          <p className="text-sm text-white/70 mt-1">{executionError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Executing state */}
                  {isExecuting && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-20 h-20 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center mb-6">
                        <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                      </div>
                      <h2 className="text-xl font-semibold text-white mb-2">Executing Flow</h2>
                      <p className="text-sm text-white/60 text-center max-w-md">
                        Orchestrating {selectedModels.length} models to collaborate on your task.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Advanced mode: tabs for task, prompts, settings
                <div>
                  {/* Tab Navigation */}
                  <div className="flex gap-2 mb-6">
                    {[
                      { id: "task" as const, label: "Task & Cost", icon: Sparkles },
                      { id: "prompts" as const, label: "System Prompts", icon: MessageSquare },
                      { id: "settings" as const, label: "LLM Settings", icon: Settings2 },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setConfigTab(tab.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                          configTab === tab.id
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  {configTab === "task" && (
                    <div className="space-y-6">
                      <div className="relative">
                        <TaskInput
                          value={taskText}
                          onChange={setTaskText}
                          isRunning={isExecuting}
                          disabled={isSynthesizing || !canProceedFromConfigure}
                        />
                        {isSynthesizing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
                            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/10 border border-white/10">
                              <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                              <span className="text-sm text-white/80">Synthesizing your discoveries...</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <CostEstimator
                        flowType={selectedType || "round-robin"}
                        models={flowModelConfigs}
                        promptText={taskText}
                        balance={50}
                        lifetimeSpend={0}
                        billingType="managed"
                      />
                    </div>
                  )}

                  {configTab === "prompts" && (
                    <SystemPromptEditor
                      agents={agentConfigs}
                      onUpdate={handleUpdateSystemPrompt}
                      onResetToDefault={handleResetSystemPrompt}
                      defaultPrompts={defaultPrompts}
                    />
                  )}

                  {configTab === "settings" && (
                    <LLMSettingsPanel
                      agents={agentConfigs}
                      onUpdateSettings={handleUpdateSettings}
                      onApplyPresetToAll={handleApplyPresetToAll}
                    />
                  )}

                  {/* Error display */}
                  {executionError && (
                    <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                      <p className="font-medium text-red-400">Execution Failed</p>
                      <p className="text-sm text-white/70 mt-1">{executionError}</p>
                    </div>
                  )}

                  {/* Executing state */}
                  {isExecuting && (
                    <div className="mt-6 flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                      </div>
                      <p className="text-white/60">
                        Executing flow with {selectedModels.length} models...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step: Results */}
          {currentStep === "results" && results && (
            <div className="p-8 space-y-6">
              {mode === "basic" ? (
                // Basic mode: view-only results
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {selectedType === "hub-spoke" ? "Hub-and-Spoke Results" : "Round-Robin Results"}
                      </h2>
                      <p className="text-sm text-white/60 mt-1">
                        {selectedModels.length} models completed in {results.execution_time_seconds.toFixed(1)}s | Total cost: ${results.total_cost.toFixed(4)}
                      </p>
                    </div>
                    <ResultsActions flowData={getFlowDataForExport()} />
                  </div>

                  <ResultsDisplay
                    flowType={selectedType || "round-robin"}
                    models={getModelsInfo()}
                    responses={getResponseData()}
                    synthesis={getSynthesisData()}
                  />

                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-4 mt-8">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-sm text-white/60">Total Cost</p>
                      <p className="text-2xl font-bold text-white">${results.total_cost.toFixed(4)}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-sm text-white/60">Execution Time</p>
                      <p className="text-2xl font-bold text-white">{results.execution_time_seconds.toFixed(1)}s</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-sm text-white/60">Models Used</p>
                      <p className="text-2xl font-bold text-white">{selectedModels.length}</p>
                    </div>
                  </div>

                  {/* Upsell for Advanced mode */}
                  <div className="mt-8 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <Settings2 className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Want more control?</p>
                          <p className="text-sm text-white/60">
                            Edit results, customize prompts, and iterate with Advanced mode.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleModeSelect("advanced")}
                        className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
                      >
                        Try Advanced
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                // Advanced mode: editable results with iteration
                <>
                  <IterationControls
                    currentTurn={currentTurnNumber}
                    turns={turns}
                    hasEdits={hasEdits}
                    isExecuting={isExecuting}
                    onRunAnotherTurn={handleRunAnotherTurn}
                    onExport={handleExport}
                  />

                  <ResultEditor
                    results={agentResults}
                    onUpdateResult={handleUpdateResult}
                    onResetResult={handleResetResult}
                    onResetAll={handleResetAllResults}
                  />

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mt-8">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-sm text-white/60">Total Cost</p>
                      <p className="text-2xl font-bold text-white">${results.total_cost.toFixed(4)}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-sm text-white/60">Execution Time</p>
                      <p className="text-2xl font-bold text-white">{results.execution_time_seconds.toFixed(1)}s</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-sm text-white/60">Turns Completed</p>
                      <p className="text-2xl font-bold text-white">{turns.length}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex items-center justify-between">
          {/* Back Button */}
          {currentStep === "choice" ? (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 rounded-xl text-white/70 font-medium hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          ) : currentStep === "results" ? (
            <button
              type="button"
              onClick={handleStartNewFlow}
              className="px-6 py-3 rounded-xl text-white/70 font-medium hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              New Flow
            </button>
          ) : (
            <button
              type="button"
              onClick={goToPrevStep}
              disabled={isExecuting}
              className="px-6 py-3 rounded-xl text-white/70 font-medium hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          {/* Continue/Run Buttons */}
          {currentStep === "choice" && (
            // No continue button on choice - handled by the choice cards
            <div />
          )}

          {currentStep === "flow-type" && (
            <ActionButton
              onClick={goToNextStep}
              disabled={!canProceedFromFlowType}
              label="Continue"
            />
          )}

          {currentStep === "mode" && (
            // Mode selection auto-advances via handleModeSelect, no button needed
            <div />
          )}

          {currentStep === "models" && (
            <ActionButton
              onClick={handleContinueFromModels}
              disabled={!canProceedFromModels}
              label="Continue"
            />
          )}

          {currentStep === "configure" && (
            <ActionButton
              onClick={handleRunFlow}
              disabled={!canProceedFromConfigure || isExecuting || isSynthesizing}
              label={isExecuting ? "Running..." : "Run Flow"}
              icon={isExecuting ? Loader2 : Play}
              variant="success"
            />
          )}

          {currentStep === "results" && (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
            >
              Done
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StepIndicator({
  step,
  label,
  isActive,
  isCurrent,
}: {
  step: number;
  label: string;
  isActive: boolean;
  isCurrent: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
          isCurrent
            ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50"
            : isActive
              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              : "bg-white/5 text-white/40 border border-white/10"
        )}
      >
        {step}
      </div>
      <span
        className={cn(
          "text-xs whitespace-nowrap",
          isCurrent ? "text-white font-semibold" : "text-white/40"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  label,
  icon: Icon,
  variant = "primary",
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "primary" | "success";
}) {
  const gradients = {
    primary: "from-indigo-500 via-purple-500 to-pink-500 shadow-purple-500/25 hover:shadow-purple-500/40",
    success: "from-green-500 via-emerald-500 to-teal-500 shadow-green-500/25 hover:shadow-green-500/40",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2",
        disabled
          ? "bg-white/5 text-white/30 cursor-not-allowed"
          : `bg-gradient-to-r ${gradients[variant]} text-white shadow-xl hover:scale-[1.02]`
      )}
    >
      {Icon && <Icon className={cn("w-5 h-5", label === "Running..." && "animate-spin")} />}
      {label}
      {!Icon && !disabled && (
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      )}
    </button>
  );
}
