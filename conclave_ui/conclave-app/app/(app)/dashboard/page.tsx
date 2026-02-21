import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTierInfo } from "@/lib/checkout";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { BYOKStatsCards } from "@/components/dashboard/byok-stats-cards";
import { RecentRuns } from "@/components/dashboard/recent-runs";

// Provider name mapping helper
function mapProviderToShortName(
  provider: string
): "claude" | "gpt" | "gemini" | "xai" {
  const mapping: Record<string, "claude" | "gpt" | "gemini" | "xai"> = {
    anthropic: "claude",
    openai: "gpt",
    google: "gemini",
    xai: "xai",
  };
  return mapping[provider] || "claude";
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, plan_type, stripe_customer_id")
    .eq("id", user.id)
    .single();

  const billingType = (profile?.plan_type as "managed" | "byok") || "managed";
  const userName = profile?.name?.split(" ")[0] || "there";

  // Fetch balance for managed users
  let balance = 0;
  if (billingType === "managed") {
    const { data: balanceData } = await supabase
      .from("balances")
      .select("amount_cents")
      .eq("user_id", user.id)
      .single();
    balance = (balanceData?.amount_cents || 0) / 100;
  }

  // Fetch subscription for BYOK users
  let renewalDate = new Date();
  if (billingType === "byok") {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .single();
    if (subscription?.current_period_end) {
      renewalDate = new Date(subscription.current_period_end);
    } else {
      // Default to 30 days from now if no subscription found
      renewalDate = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  // Get this month's start date
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Fetch monthly stats
  const { data: monthlyRuns } = await supabase
    .from("runs")
    .select("cost_cents, input_tokens, output_tokens")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth.toISOString());

  const monthlySpend =
    (monthlyRuns?.reduce((sum, r) => sum + (r.cost_cents || 0), 0) || 0) / 100;
  const monthlyRunCount = monthlyRuns?.length || 0;

  // Calculate tier from total spend (lifetime)
  const { data: allRuns } = await supabase
    .from("runs")
    .select("cost_cents")
    .eq("user_id", user.id);

  const totalSpendCents =
    allRuns?.reduce((sum, r) => sum + (r.cost_cents || 0), 0) || 0;
  const tierInfo = getTierInfo(totalSpendCents);

  // Calculate next tier info
  const nextTier = tierInfo.nextTierSpend
    ? {
        name: `Tier ${tierInfo.tier + 1}`,
        markup: tierInfo.markup - 5, // Next tier is 5% less markup
        requiredSpend: tierInfo.nextTierSpend / 100, // Convert to dollars
      }
    : null;

  const tier = {
    current: tierInfo.tier,
    name: tierInfo.name,
    markup: tierInfo.markup,
    nextTier,
    currentSpend: totalSpendCents / 100, // Convert to dollars
  };

  // Fetch recent runs (last 5)
  const { data: recentRunsData } = await supabase
    .from("runs")
    .select(
      "id, flow_type, models, created_at, input_tokens, output_tokens, cost_cents"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Transform runs to the format expected by RecentRuns component
  const recentRuns =
    recentRunsData?.map((run) => {
      const models = (run.models as Array<{ id: string; name: string; provider: string }>) || [];
      return {
        id: run.id,
        flowType: run.flow_type === "basic" ? ("round-robin" as const) : ("hub-spoke" as const),
        flowLabel: run.flow_type === "basic" ? "Round-Robin" : "Hub-Spoke",
        models: models.map((m) => ({
          id: m.id,
          name: m.name,
          provider: mapProviderToShortName(m.provider),
        })),
        timestamp: new Date(run.created_at),
        tokenCount: (run.input_tokens || 0) + (run.output_tokens || 0),
        cost: (run.cost_cents || 0) / 100,
      };
    }) || [];

  const isBYOK = billingType === "byok";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
          Welcome back, {userName}
        </h1>
        <p className="text-white/50 mt-2 text-lg">
          Here&apos;s what&apos;s happening with your flows.
        </p>
      </div>

      {/* Quick Actions */}
      <QuickActions billingType={billingType} />

      {/* Stats Cards - Show different cards based on billing type */}
      {isBYOK ? (
        <BYOKStatsCards
          monthlyRuns={monthlyRunCount}
          renewalDate={renewalDate}
        />
      ) : (
        <StatsCards
          balance={balance}
          monthlySpend={monthlySpend}
          monthlyRuns={monthlyRunCount}
          tier={tier}
        />
      )}

      {/* Recent Runs */}
      <RecentRuns runs={recentRuns} />
    </div>
  );
}
