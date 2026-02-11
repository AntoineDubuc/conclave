/**
 * Discovery Chat Component
 *
 * A conversational interface for the discovery phase where users
 * explore and refine their ideas before running a flow.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiscoveryChat, type DiscoveryMessage } from "@/lib/hooks/use-discovery-chat";
import {
  ALL_MODELS,
  PROVIDERS,
  PREMIUM_PROVIDERS,
  OPEN_SOURCE_PROVIDERS,
  OTHER_PROVIDERS,
  type ModelInfo,
  type ProviderId,
  type ModelTier,
  formatPricePair,
  MODELS_BY_PROVIDER,
} from "@/lib/models";

// =============================================================================
// Types
// =============================================================================

type FlowType = "round-robin" | "hub-spoke";

export interface DiscoveryContinueData {
  transcript: string;
  modelId: string;
  provider: string;
}

interface DiscoveryChatProps {
  onContinue: (data: DiscoveryContinueData) => void;
  onSkip: () => void;
  apiKeys?: Record<string, string>;
  /** Selected flow type - used to show contextual content */
  flowType?: FlowType;
}

// =============================================================================
// Constants
// =============================================================================

// Get default model (first model from Anthropic which is Opus 4.5)
const DEFAULT_MODEL = ALL_MODELS.find((m) => m.isBest && m.provider === "anthropic") || ALL_MODELS[0];

// Flow-specific context content
const FLOW_CONTEXT: Record<FlowType, {
  title: string;
  description: string;
  suggestedPrompts: string[];
}> = {
  "round-robin": {
    title: "Explore Multiple Perspectives",
    description: "This flow lets multiple AI models respond independently to your prompt, then refine their answers after seeing each other's work. Perfect for getting diverse viewpoints.",
    suggestedPrompts: [
      "I need diverse opinions on a business strategy",
      "Help me brainstorm ideas from different angles",
      "I want multiple perspectives on a decision I'm making",
      "Compare different approaches to solving a problem",
    ],
  },
  "hub-spoke": {
    title: "Synthesize Expert Input",
    description: "A leader model will orchestrate contributors and synthesize their specialized input into a comprehensive response. Best for complex tasks requiring coordination.",
    suggestedPrompts: [
      "I have a complex task that needs coordination",
      "Help me break down a problem for specialized analysis",
      "I need a synthesized view from multiple experts",
      "Orchestrate a comprehensive analysis of my topic",
    ],
  },
};

const DEFAULT_SUGGESTED_PROMPTS = [
  "Help me think through a complex business decision",
  "I want to analyze something from multiple perspectives",
  "I need to brainstorm ideas for a project",
  "Help me refine my problem statement",
];

// =============================================================================
// Sub-components
// =============================================================================

// Tier configuration for model selector dropdown
interface TierConfig {
  id: ModelTier;
  title: string;
  providers: ProviderId[];
  headerColor: string;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    id: "premium",
    title: "Premium",
    providers: PREMIUM_PROVIDERS,
    headerColor: "text-amber-400",
  },
  {
    id: "open-source",
    title: "Open Source",
    providers: [...OPEN_SOURCE_PROVIDERS, ...OTHER_PROVIDERS],
    headerColor: "text-blue-400",
  },
];

function ModelSelector({
  selectedModel,
  onSelect,
  disabled,
}: {
  selectedModel: ModelInfo;
  onSelect: (model: ModelInfo) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Format price display with FREE handling
  const formatPrice = (model: ModelInfo): string => {
    const isFree = model.tier === "free" || (model.inputPrice === 0 && model.outputPrice === 0);
    if (isFree) return "FREE";
    return formatPricePair(model.inputPrice, model.outputPrice);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
          "bg-white/5 border-white/10 hover:border-white/20",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span className="text-sm text-white">
          {selectedModel.isBest && "⭐ "}{selectedModel.name}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/40 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl shadow-xl z-20">
            {TIER_CONFIGS.map((tier) => {
              // Get all models for providers in this tier
              const tierModels = tier.providers.flatMap((providerId) => {
                const models = MODELS_BY_PROVIDER[providerId] || [];
                return models.filter((m) => !m.isLegacy);
              });

              if (tierModels.length === 0) return null;

              return (
                <div key={tier.id}>
                  {/* Tier header */}
                  <div
                    className={cn(
                      "px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b border-white/10 sticky top-0 bg-[#1a1a2e]",
                      tier.headerColor
                    )}
                  >
                    ── {tier.title} ──
                  </div>

                  {/* Providers within tier */}
                  {tier.providers.map((providerId) => {
                    const provider = PROVIDERS[providerId];
                    const models = (MODELS_BY_PROVIDER[providerId] || []).filter(
                      (m) => !m.isLegacy
                    );
                    if (!models.length) return null;

                    return (
                      <div key={providerId}>
                        {/* Provider sub-header */}
                        <div
                          className="px-4 py-1.5 text-xs font-medium border-b border-white/5"
                          style={{ color: provider.color }}
                        >
                          — {provider.name} —
                        </div>

                        {/* Models for this provider */}
                        {models.map((model) => {
                          const priceDisplay = formatPrice(model);
                          const isFree = priceDisplay === "FREE";

                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => {
                                onSelect(model);
                                setIsOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors",
                                "hover:bg-white/5",
                                model.id === selectedModel.id && "bg-purple-500/10"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    model.id === selectedModel.id
                                      ? "bg-purple-400"
                                      : "bg-white/20"
                                  )}
                                />
                                <span className="text-sm text-white">
                                  {model.isBest && "⭐ "}{model.name}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "text-xs font-mono",
                                  isFree
                                    ? "text-green-400 font-medium"
                                    : "text-white/40"
                                )}
                              >
                                {priceDisplay}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Free tier section */}
            {(() => {
              const freeModels = ALL_MODELS.filter(
                (m) => !m.isLegacy && (m.tier === "free" || (m.inputPrice === 0 && m.outputPrice === 0))
              );
              if (freeModels.length === 0) return null;

              return (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b border-white/10 sticky top-0 bg-[#1a1a2e] text-green-400">
                    ── Free ──
                  </div>
                  {freeModels.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onSelect(model);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors",
                        "hover:bg-white/5",
                        model.id === selectedModel.id && "bg-purple-500/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            model.id === selectedModel.id
                              ? "bg-purple-400"
                              : "bg-white/20"
                          )}
                        />
                        <span className="text-sm text-white">
                          {model.isBest && "⭐ "}{model.name}
                        </span>
                        <span className="text-xs text-white/40">
                          ({PROVIDERS[model.provider]?.name || model.provider})
                        </span>
                      </div>
                      <span className="text-xs text-green-400 font-medium font-mono">
                        FREE
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: DiscoveryMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white"
            : "bg-white/5 border border-white/10 text-white"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {message.isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-white/50 animate-pulse" />
        )}
      </div>
    </div>
  );
}

function EmptyState({
  onPromptClick,
  flowType,
}: {
  onPromptClick: (prompt: string) => void;
  flowType?: FlowType;
}) {
  const context = flowType ? FLOW_CONTEXT[flowType] : null;
  const suggestedPrompts = context?.suggestedPrompts || DEFAULT_SUGGESTED_PROMPTS;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
        <MessageSquare className="w-8 h-8 text-purple-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">
        {context?.title || "Discovery Chat"}
      </h3>
      <p className="text-white/60 max-w-md mb-6">
        {context?.description || "Explore your ideas with AI before running a flow. This helps clarify what you want to accomplish and refine your task."}
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DiscoveryChat({
  onContinue,
  onSkip,
  apiKeys,
  flowType,
}: DiscoveryChatProps) {
  const [selectedModel, setSelectedModel] = useState<ModelInfo>(DEFAULT_MODEL);
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get API key for selected provider
  const provider = PROVIDERS[selectedModel.provider];
  const apiKey = apiKeys?.[provider.envKey];

  const {
    messages,
    isStreaming,
    isConnecting,
    error,
    sendMessage,
    clearMessages,
    getTranscript,
  } = useDiscoveryChat({
    model: selectedModel.id,
    provider: selectedModel.provider,
    apiKey,
    temperature: 0.8,
    maxTokens: 2048,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || isStreaming || isConnecting) return;
    sendMessage(inputValue.trim());
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue, isStreaming, isConnecting, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleContinue = useCallback(() => {
    onContinue({
      transcript: getTranscript(),
      modelId: selectedModel.id,
      provider: selectedModel.provider,
    });
  }, [onContinue, getTranscript, selectedModel]);

  const canSubmit = inputValue.trim().length > 0 && !isStreaming && !isConnecting;
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <ModelSelector
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            disabled={isStreaming || isConnecting}
          />
          {hasMessages && (
            <button
              type="button"
              onClick={clearMessages}
              disabled={isStreaming || isConnecting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">Clear</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!hasMessages}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              hasMessages
                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
                : "bg-white/5 text-white/40 cursor-not-allowed"
            )}
          >
            Continue to Configure
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isConnecting && (
              <div className="flex items-center gap-2 text-white/40">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Connecting...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <EmptyState onPromptClick={(prompt) => sendMessage(prompt)} flowType={flowType} />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 bg-white/5 backdrop-blur-sm p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Explore your ideas..."
              disabled={isStreaming || isConnecting}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40",
                "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "border-white/10 hover:border-white/20 transition-colors"
              )}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-xl transition-all",
              canSubmit
                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            )}
          >
            {isStreaming || isConnecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        <p className="text-xs text-white/40 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
