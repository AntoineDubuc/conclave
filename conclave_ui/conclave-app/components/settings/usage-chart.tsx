"use client";

import { TrendingUp, Activity } from "lucide-react";

interface UsageData {
  month: string;
  spend: number;
  runs: number;
}

interface UsageChartProps {
  data: UsageData[];
}

export function UsageChart({ data }: UsageChartProps) {
  // Reverse data to show oldest to newest (left to right)
  const chartData = [...data].reverse();

  // Find max spend for scaling
  const maxSpend = Math.max(...chartData.map((d) => d.spend));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/10 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">
            Usage History
          </h3>
          <p className="text-sm text-white/60">
            Your spending and run history over the past 6 months
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Activity className="h-4 w-4" />
          <span>6 Months</span>
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-6">
        {/* Spend Chart */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-white mb-3">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            <span>Monthly Spend</span>
          </div>
          <div className="space-y-2">
            {chartData.map((item, index) => {
              const barWidth = (item.spend / maxSpend) * 100;
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-12 text-xs text-white/60 font-medium">
                    {item.month}
                  </div>
                  <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-lg transition-all duration-500 ease-out"
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-semibold text-white drop-shadow-lg">
                        {formatCurrency(item.spend)}
                      </span>
                    </div>
                  </div>
                  <div className="w-16 text-xs text-white/60 text-right">
                    {item.runs} runs
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="pt-4 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-white/60">Total Spend</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(chartData.reduce((sum, d) => sum + d.spend, 0))}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/60">Total Runs</p>
              <p className="text-lg font-bold text-white">
                {chartData.reduce((sum, d) => sum + d.runs, 0)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/60">Avg per Month</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(
                  chartData.reduce((sum, d) => sum + d.spend, 0) /
                    chartData.length
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/60">Avg per Run</p>
              <p className="text-lg font-bold text-white">
                {(() => {
                  const totalSpend = chartData.reduce((sum, d) => sum + d.spend, 0);
                  const totalRuns = chartData.reduce((sum, d) => sum + d.runs, 0);
                  return formatCurrency(totalRuns > 0 ? totalSpend / totalRuns : 0);
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
