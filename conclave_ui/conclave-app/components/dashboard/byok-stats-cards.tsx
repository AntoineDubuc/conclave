"use client";

import { Card } from "@/components/ui/card";
import { Key, Activity, Calendar } from "lucide-react";

/**
 * Skeleton loader for BYOKStatsCards - matches exact dimensions of real content
 * to prevent layout shift when data loads
 */
export function BYOKStatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Plan Card Skeleton */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-12 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="h-9 w-20 bg-white/10 rounded animate-pulse mb-1" />
        <div className="h-3 w-16 bg-white/5 rounded animate-pulse mt-3" />
      </Card>

      {/* Runs This Month Skeleton */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="h-9 w-12 bg-white/10 rounded animate-pulse mb-1" />
        <div className="h-3 w-10 bg-white/5 rounded animate-pulse mt-3" />
      </Card>

      {/* Renewal Card Skeleton */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="h-9 w-24 bg-white/10 rounded animate-pulse mb-1" />
        <div className="h-3 w-28 bg-white/5 rounded animate-pulse mt-3" />
      </Card>
    </div>
  );
}

interface BYOKStatsCardsProps {
  monthlyRuns: number;
  renewalDate: Date;
}

export function BYOKStatsCards({ monthlyRuns, renewalDate }: BYOKStatsCardsProps) {
  const daysUntilRenewal = Math.ceil(
    (renewalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const formattedRenewalDate = renewalDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Plan Card */}
      <Card className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Key className="h-4 w-4" />
              <span>Plan</span>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              BYOK
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-3">$10/mo</div>
      </Card>

      {/* Runs This Month Card */}
      <Card className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span>This Month</span>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {monthlyRuns}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-3">
          {monthlyRuns === 1 ? "run" : "runs"}
        </div>
      </Card>

      {/* Renewal Card */}
      <Card className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span>Renewal</span>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {formattedRenewalDate}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-3">
          {daysUntilRenewal} {daysUntilRenewal === 1 ? "day" : "days"} remaining
        </div>
      </Card>
    </div>
  );
}
