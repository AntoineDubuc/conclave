/**
 * Result Editor Component
 *
 * An editable view of agent outputs that tracks changes and can
 * feed edits into the next iteration.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Edit3,
  Eye,
  RotateCcw,
  ChevronDown,
  Crown,
  Check,
  X,
  GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/ui/markdown-content";

// =============================================================================
// Types
// =============================================================================

export interface AgentResult {
  agentId: string;
  agentName: string;
  provider: string;
  role: "leader" | "contributor";
  originalContent: string;
  editedContent: string;
  isEdited: boolean;
}

interface ResultEditorProps {
  results: AgentResult[];
  onUpdateResult: (agentId: string, content: string) => void;
  onResetResult: (agentId: string) => void;
  onResetAll: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  openai: "text-green-400 bg-green-500/10 border-green-500/30",
  google: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  xai: "text-purple-400 bg-purple-500/10 border-purple-500/30",
};

// =============================================================================
// Sub-components
// =============================================================================

function DiffView({
  original,
  edited,
}: {
  original: string;
  edited: string;
}) {
  // Simple line-by-line diff visualization
  const originalLines = original.split("\n");
  const editedLines = edited.split("\n");

  return (
    <div className="font-mono text-sm space-y-1">
      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
        <p className="text-xs text-red-400 mb-2">Original</p>
        <div className="text-red-300/80 whitespace-pre-wrap">
          {originalLines.map((line, i) => (
            <div key={`orig-${i}`} className="min-h-[1.5em]">
              {line || " "}
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <p className="text-xs text-green-400 mb-2">Edited</p>
        <div className="text-green-300/80 whitespace-pre-wrap">
          {editedLines.map((line, i) => (
            <div key={`edit-${i}`} className="min-h-[1.5em]">
              {line || " "}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  onUpdate,
  onReset,
}: {
  result: AgentResult;
  onUpdate: (content: string) => void;
  onReset: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [localContent, setLocalContent] = useState(result.editedContent);

  const providerColor = PROVIDER_COLORS[result.provider] || "text-white/70 bg-white/5 border-white/20";

  // Sync local content when result changes
  if (localContent !== result.editedContent && !isEditMode) {
    setLocalContent(result.editedContent);
  }

  const handleSaveEdit = useCallback(() => {
    onUpdate(localContent);
    setIsEditMode(false);
  }, [localContent, onUpdate]);

  const handleCancelEdit = useCallback(() => {
    setLocalContent(result.editedContent);
    setIsEditMode(false);
  }, [result.editedContent]);

  const handleReset = useCallback(() => {
    onReset();
    setLocalContent(result.originalContent);
    setShowDiff(false);
  }, [onReset, result.originalContent]);

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors",
          "hover:bg-white/5",
          isExpanded && "bg-white/5"
        )}
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn(
              "w-5 h-5 text-white/40 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
          <div className="flex items-center gap-2">
            {result.role === "leader" && (
              <Crown className="w-4 h-4 text-amber-400" />
            )}
            <span className="font-medium text-white">{result.agentName}</span>
          </div>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium border",
              providerColor
            )}
          >
            {result.provider}
          </span>
          {result.isEdited && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
              Edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">
            {result.editedContent.length} chars
          </span>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 pt-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {!isEditMode ? (
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {result.isEdited && !isEditMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDiff(!showDiff)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors",
                      showDiff
                        ? "bg-purple-500/20 text-purple-400"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    {showDiff ? "Hide Diff" : "Show Diff"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </>
              )}
              {!isEditMode && !showDiff && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              )}
            </div>
          </div>

          {/* Content Area */}
          {showDiff ? (
            <DiffView original={result.originalContent} edited={result.editedContent} />
          ) : isEditMode ? (
            <textarea
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              className={cn(
                "w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-white font-mono",
                "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                "border-white/10 hover:border-white/20 transition-colors",
                "resize-y min-h-[200px]"
              )}
              placeholder="Enter content..."
            />
          ) : (
            <MarkdownContent className="rounded-xl border border-white/10 bg-white/5 p-4 overflow-auto max-h-[400px]">
              {result.editedContent}
            </MarkdownContent>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ResultEditor({
  results,
  onUpdateResult,
  onResetResult,
  onResetAll,
}: ResultEditorProps) {
  const editedCount = useMemo(
    () => results.filter((r) => r.isEdited).length,
    [results]
  );

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Edit3 className="w-8 h-8 text-white/20" />
        </div>
        <p className="text-white/60">No results to display</p>
        <p className="text-sm text-white/40 mt-1">
          Run the flow to see agent outputs here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Results</h3>
          <p className="text-sm text-white/60 mt-1">
            Review and edit agent outputs. Edits will be used in the next iteration.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {editedCount > 0 && (
            <>
              <span className="text-sm text-purple-400">
                {editedCount} of {results.length} edited
              </span>
              <button
                type="button"
                onClick={onResetAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Result Cards */}
      <div className="space-y-4">
        {results.map((result) => (
          <ResultCard
            key={result.agentId}
            result={result}
            onUpdate={(content) => onUpdateResult(result.agentId, content)}
            onReset={() => onResetResult(result.agentId)}
          />
        ))}
      </div>
    </div>
  );
}
