"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RunListItem } from "@/components/runs/run-list-item";

/**
 * Skeleton loader for RecentRuns - matches exact dimensions of real content
 * to prevent layout shift when data loads
 */
export function RecentRunsSkeleton() {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="divide-y divide-white/10">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              {/* Flow type badge skeleton */}
              <div className="h-6 w-24 bg-white/10 rounded-full animate-pulse" />
              {/* Model pills skeleton */}
              <div className="flex gap-1.5">
                <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse" />
                <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse" />
              </div>
              {/* Spacer */}
              <div className="flex-1" />
              {/* Stats skeleton */}
              <div className="flex items-center gap-4">
                <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-12 bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-white/10">
          <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

interface RecentRunsProps {
  runs: Array<{
    id: string;
    flowType: "round-robin" | "hub-spoke";
    flowLabel: string;
    models: Array<{
      id: string;
      name: string;
      provider: "claude" | "gpt" | "gemini" | "xai";
    }>;
    timestamp: Date;
    tokenCount: number;
    cost: number;
  }>;
}

export function RecentRuns({ runs }: RecentRunsProps) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold">Recent Runs</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {runs.length > 0 ? (
          <>
            <div className="divide-y divide-white/10">
              {runs.map((run) => (
                <Link key={run.id} href={`/runs/${run.id}`}>
                  <RunListItem
                    {...run}
                  />
                </Link>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-white/10">
              <Link
                href="/runs"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                View All Runs
              </Link>
            </div>
          </>
        ) : (
          <div className="px-6 py-8 text-center">
            <p className="text-muted-foreground">
              No runs yet. Start a new flow to get started.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
