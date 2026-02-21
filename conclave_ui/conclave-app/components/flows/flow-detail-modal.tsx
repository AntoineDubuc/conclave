"use client";

import * as React from "react";
import { useState } from "react";
import {
  Users,
  Layers,
  Calendar,
  Play,
  Copy,
  Pencil,
  Trash2,
  GitFork,
  TrendingUp,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Flow } from "@/lib/types/flow";
import { formatCost, getComplexityLabel } from "@/lib/types/flow";

export interface FlowDetailModalProps {
  flow: Flow | null;
  isOpen: boolean;
  onClose: () => void;
  onUse: () => void;
  onDuplicate: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
  isDuplicating?: boolean;
}

export function FlowDetailModal({
  flow,
  isOpen,
  onClose,
  onUse,
  onDuplicate,
  onEdit,
  onDelete,
  isOwner = false,
  isDuplicating = false,
}: FlowDetailModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!flow) return null;

  const complexity = getComplexityLabel(flow.participant_count, flow.phase_count);
  const createdDate = new Date(flow.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete?.();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl pr-8">{flow.name}</DialogTitle>
          {/* Author and date */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            {flow.author && (
              <>
                <span>by</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-medium">
                    {flow.author.name?.[0]?.toUpperCase() ||
                      flow.author.email[0].toUpperCase()}
                  </div>
                  <span className="font-medium text-white/80">
                    {flow.author.name || flow.author.email.split("@")[0]}
                  </span>
                </div>
                <span>•</span>
              </>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{createdDate}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Flow Diagram (ASCII representation) */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 font-mono text-xs text-zinc-300 overflow-x-auto">
            <pre className="whitespace-pre">
              {generateFlowDiagram(flow)}
            </pre>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Description</h4>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {flow.description || "No description provided."}
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Participants"
              value={flow.participant_count.toString()}
            />
            <StatCard
              icon={Layers}
              label="Phases"
              value={flow.phase_count.toString()}
            />
            <StatCard
              icon={TrendingUp}
              label="Complexity"
              value={complexity}
              valueClassName={cn(
                complexity === "Simple" && "text-green-400",
                complexity === "Moderate" && "text-yellow-400",
                complexity === "Complex" && "text-red-400"
              )}
            />
            <StatCard
              icon={Play}
              label="Est. Cost"
              value={formatCost(flow.estimated_cost_cents)}
            />
          </div>

          {/* Usage Stats */}
          <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Play className="h-4 w-4" />
                  <span>
                    <span className="text-white font-medium">{flow.run_count}</span>{" "}
                    runs
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Copy className="h-4 w-4" />
                  <span>
                    <span className="text-white font-medium">{flow.duplicate_count}</span>{" "}
                    duplicates
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Forked From Attribution */}
          {flow.forked_from && flow.original_author && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <GitFork className="h-4 w-4" />
              <span>
                Based on a flow by{" "}
                <span className="text-zinc-300">
                  {flow.original_author.name ||
                    flow.original_author.email.split("@")[0]}
                </span>
              </span>
            </div>
          )}

          <Separator className="bg-zinc-800" />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isOwner ? (
              // Owner actions
              <>
                <Button
                  onClick={onUse}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Use This Flow
                </Button>
                {onEdit && (
                  <Button
                    onClick={onEdit}
                    variant="outline"
                    className="border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    onClick={handleDelete}
                    variant="outline"
                    className={cn(
                      "border-zinc-700",
                      showDeleteConfirm
                        ? "border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "text-zinc-400 hover:text-red-400 hover:border-red-500/50 hover:bg-zinc-800"
                    )}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {showDeleteConfirm ? "Confirm Delete" : "Delete"}
                  </Button>
                )}
              </>
            ) : (
              // Non-owner actions
              <>
                <Button
                  onClick={onDuplicate}
                  variant="outline"
                  disabled={isDuplicating}
                  className="flex-1 border-zinc-700 text-white hover:bg-zinc-800"
                >
                  {isDuplicating ? (
                    <>
                      <span className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Duplicating...
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate to My Flows
                    </>
                  )}
                </Button>
                <Button
                  onClick={onUse}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Use This Flow
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for stat cards
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClassName?: string;
}

function StatCard({ icon: Icon, label, value, valueClassName }: StatCardProps) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
      <div className="flex items-center gap-2 text-zinc-400 mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className={cn("text-lg font-semibold text-white", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

// Generate ASCII flow diagram from config
function generateFlowDiagram(flow: Flow): string {
  const config = flow.config;
  if (!config?.phases || config.phases.length === 0) {
    return "  No phases defined";
  }

  const lines: string[] = [];
  const maxWidth = 50;

  // Header
  const title = flow.name.toUpperCase();
  const headerPadding = Math.max(0, Math.floor((maxWidth - title.length) / 2));
  lines.push("+" + "-".repeat(maxWidth) + "+");
  lines.push("|" + " ".repeat(headerPadding) + title + " ".repeat(maxWidth - headerPadding - title.length) + "|");
  lines.push("|" + " ".repeat(Math.floor((maxWidth - 25) / 2)) + `(${config.phases.length} phases, ${config.participants?.length || 0} models)` + " ".repeat(Math.ceil((maxWidth - 25) / 2)) + "|");
  lines.push("+" + "-".repeat(maxWidth) + "+");
  lines.push("|" + " ".repeat(maxWidth) + "|");

  // Phases
  config.phases.forEach((phase, index) => {
    const phaseName = `Phase ${index + 1}: ${phase.name}`;
    const phaseType = phase.type === "parallel" ? "[PARALLEL]" : "[SEQUENTIAL]";
    const participants = phase.executors?.join(", ") || phase.executor || "all";

    lines.push("|  " + phaseName.padEnd(maxWidth - 4) + "  |");
    lines.push("|  " + phaseType.padEnd(maxWidth - 4) + "  |");
    lines.push("|  " + `Models: ${participants}`.slice(0, maxWidth - 4).padEnd(maxWidth - 4) + "  |");

    if (index < config.phases.length - 1) {
      lines.push("|" + " ".repeat(Math.floor(maxWidth / 2) - 1) + "↓" + " ".repeat(Math.ceil(maxWidth / 2)) + "|");
    }
  });

  lines.push("|" + " ".repeat(maxWidth) + "|");
  lines.push("+" + "-".repeat(maxWidth) + "+");

  return lines.join("\n");
}
