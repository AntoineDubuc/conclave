# Implementation Plan 3: Billing Management

---

## ⛔ CRITICAL: MANDATORY DESIGN SYSTEM COMPLIANCE

> **STOP! Before implementing ANY UI component in this plan, you MUST:**
> 1. Read `/docs/DESIGN_SYSTEM.md` - the complete design specification
> 2. Read `/docs/DESIGN_TOKENS.md` - CSS variables and utility classes reference
> 3. Understand and use the glass-gradient aesthetic throughout

### Why This Matters
**Rewriting UI is extremely costly.** Every component must match the design system from the start. There is NO acceptable reason to use generic Tailwind classes when design system utilities exist.

### Required Design System Classes

| Instead of... | Use... |
|--------------|--------|
| `bg-white dark:bg-gray-800` | `glass-card` |
| `bg-gray-50 dark:bg-gray-700/50` | `glass-subtle` |
| `rounded-lg border border-gray-200 dark:border-gray-700` | `glass-card` or `glass-panel` |
| `text-gray-900 dark:text-white` | `text-white` |
| `text-gray-600 dark:text-gray-400` | `text-white/70` |
| `text-gray-500 dark:text-gray-400` | `text-white/50` |
| `bg-indigo-600 hover:bg-indigo-700` | `gradient-brand hover:shadow-purple-500/40` |
| `border-gray-300 dark:border-gray-600` | `border-white/20` |
| `divide-gray-200 dark:divide-gray-700` | `divide-white/10` |
| `hover:bg-gray-50 dark:hover:bg-gray-700/50` | `hover:bg-white/5` |

### Mandatory Patterns for This Plan

**All Cards:**
```tsx
<div className="glass-card p-6">
  {/* card content */}
</div>
```

**All Modals/Dialogs:**
```tsx
<Dialog.Panel className="glass-card mx-auto max-w-md w-full">
```

**All Primary Buttons:**
```tsx
<button className="gradient-brand text-white px-4 py-2 rounded-lg hover:shadow-purple-500/40">
```

**All Secondary/Outline Buttons:**
```tsx
<button className="border-white/20 text-white/80 hover:border-white/40 hover:text-white px-4 py-2 rounded-lg bg-transparent">
```

**All Info/Fee Boxes:**
```tsx
<div className="glass-subtle rounded-lg p-4">
```

**All Error Messages:**
```tsx
<div className="glass p-3 rounded-lg border border-red-500/30 text-red-400">
```

**All Page Backgrounds:**
```tsx
<div className="min-h-screen bg-[var(--bg-base)]">
```

---

## Overview

This plan implements the billing management features for Conclave, enabling users to view their billing information, switch between plans, handle insufficient balance scenarios, and view transaction history with tier progress.

**Scope:**
- Flow 4: Plan Switching (Managed <-> BYOK)
- Flow 5: Insufficient Balance During Run
- Billing Settings page (real data integration)
- Transaction history with pagination
- Tier calculation and progress display
- Plan Switcher Modal
- Insufficient Balance Modal

**Does NOT include:**
- Initial checkout flows (Plan 2: Core Checkout)
- Subscription cancellation/pause (Plan 4: Subscription Lifecycle)
- Gift/referral features (Plan 6: BYOK and Social)
- API key encryption (Plan 6: BYOK and Social)
- Rate limiting and security (Plan 5: Security Hardening)

**Note:** Auto-refill settings and low balance warnings ARE included in this plan (see Tasks 20-21).

**Dependencies:**
- Plan 1: Infrastructure (Supabase schema, Stripe setup, webhook handler) - MUST be complete
- Plan 2: Core Checkout (credit purchase, BYOK subscription) - MUST be complete

---

## Prerequisites

| Requirement | Status | Notes |
|-------------|--------|-------|
| **DESIGN_SYSTEM.md read and understood** | **MANDATORY** | Must complete before ANY UI work |
| **DESIGN_TOKENS.md read and understood** | **MANDATORY** | Must complete before ANY UI work |
| Plan 1 Complete | Required | Database schema deployed, Stripe configured |
| Plan 2 Complete | Required | Checkout flows working |
| Supabase tables | Required | `profiles`, `balances`, `transactions`, `subscriptions` |
| Stripe Customer Portal | Required | For payment method updates |
| User authenticated | Required | All endpoints require auth |

> **⚠️ DESIGN SYSTEM CHECKPOINT:** Do NOT proceed until you can identify by memory:
> - The glass utility classes (`glass`, `glass-card`, `glass-panel`, `glass-subtle`)
> - The gradient utilities (`gradient-brand`, `gradient-brand-text`, `gradient-border`)
> - The typography classes (`text-h1`, `text-h2`, `text-h3`, `text-body-lg`)
> - The color variables (`--bg-base`, `--bg-elevated`, `--text-primary`, `--text-secondary`)
> - Dark theme text colors (`text-white`, `text-white/70`, `text-white/50`)

---

## File Structure

```
conclave_ui/conclave-app/
├── app/
│   ├── settings/
│   │   └── billing/
│   │       └── page.tsx                 # Billing settings page
│   └── api/
│       ├── billing/
│       │   ├── balance/
│       │   │   └── route.ts             # GET user balance
│       │   ├── transactions/
│       │   │   └── route.ts             # GET transaction history
│       │   └── portal/
│       │       └── route.ts             # POST create Stripe portal session
│       ├── plans/
│       │   └── switch/
│       │       └── route.ts             # POST switch between plans
│       └── user/
│           └── tier/
│               └── route.ts             # GET user tier and progress
├── components/
│   └── billing/
│       ├── BillingSettingsPage.tsx      # Main billing page component
│       ├── BalanceCard.tsx              # Balance display with add funds CTA
│       ├── TierProgressCard.tsx         # Tier progress visualization
│       ├── TransactionHistory.tsx       # Transaction list with pagination
│       ├── PlanCard.tsx                 # Current plan display
│       ├── PlanSwitchModal.tsx          # Modal for plan switching
│       ├── InsufficientBalanceModal.tsx # Modal for low balance during run
│       └── AddCreditsModal.tsx          # Modal for adding credits
├── lib/
│   ├── billing/
│   │   ├── tiers.ts                     # Tier calculation logic
│   │   └── types.ts                     # Billing-related types
│   └── hooks/
│       ├── useBillingData.ts            # Hook for billing data
│       └── useTransactions.ts           # Hook for transaction history
└── types/
    └── billing.ts                       # TypeScript interfaces
```

---

## Task Breakdown

### Task 1: Billing Types and Constants

Create type definitions and tier constants.

**File:** `lib/billing/types.ts`

```typescript
// Tier definitions based on monthly spend (in cents)
// Matches user story: $0-$99 (30%), $100-$499 (25%), $500-$999 (20%),
// $1,000-$4,999 (15%), $5,000-$9,999 (10%), $10,000-$99,999 (5%), $100,000+ (1%)
export const VOLUME_TIERS = [
  { minSpend: 0, maxSpend: 9999, markup: 30, name: 'Tier 1' },        // $0-$99
  { minSpend: 10000, maxSpend: 49999, markup: 25, name: 'Tier 2' },   // $100-$499
  { minSpend: 50000, maxSpend: 99999, markup: 20, name: 'Tier 3' },   // $500-$999
  { minSpend: 100000, maxSpend: 499999, markup: 15, name: 'Tier 4' }, // $1,000-$4,999
  { minSpend: 500000, maxSpend: 999999, markup: 10, name: 'Tier 5' }, // $5,000-$9,999
  { minSpend: 1000000, maxSpend: 9999999, markup: 5, name: 'Tier 6' },// $10,000-$99,999
  { minSpend: 10000000, maxSpend: Infinity, markup: 1, name: 'Enterprise' }, // $100,000+
] as const;

export type PlanType = 'managed' | 'byok';

export interface UserBalance {
  amountCents: number;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'refund' | 'gift_sent' | 'gift_received' | 'referral_bonus';
  amountCents: number;
  description: string;
  runId?: string;
  stripePaymentId?: string;
  createdAt: string;
}

export interface TransactionPage {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UserTier {
  currentTier: number;
  tierName: string;
  markup: number;
  monthlySpendCents: number;
  nextTierAt: number | null;
  progressPercent: number;
  savingsThisMonth: number;
}

export interface Subscription {
  id: string;
  stripeSubscriptionId: string;
  status: 'active' | 'canceled' | 'paused' | 'past_due' | 'incomplete';
  currentPeriodEnd: string;
  cancelAt?: string;
  pauseResumesAt?: string;
}

export interface BillingData {
  planType: PlanType;
  balance: UserBalance | null;
  subscription: Subscription | null;
  tier: UserTier;
}
```

---

### Task 2: Tier Calculation Logic

Implement tier calculation based on monthly spend.

**File:** `lib/billing/tiers.ts`

```typescript
import { VOLUME_TIERS, UserTier } from './types';

/**
 * Calculate user's current tier based on monthly spend
 * Spend is calculated per calendar month and resets on the 1st
 */
export function calculateTier(monthlySpendCents: number): UserTier {
  let currentTierIndex = 0;

  for (let i = VOLUME_TIERS.length - 1; i >= 0; i--) {
    if (monthlySpendCents >= VOLUME_TIERS[i].minSpend) {
      currentTierIndex = i;
      break;
    }
  }

  const currentTier = VOLUME_TIERS[currentTierIndex];
  const nextTier = VOLUME_TIERS[currentTierIndex + 1];

  // Calculate progress to next tier
  let progressPercent = 100;
  let nextTierAt: number | null = null;

  if (nextTier) {
    const tierRange = nextTier.minSpend - currentTier.minSpend;
    const spendInTier = monthlySpendCents - currentTier.minSpend;
    progressPercent = Math.min(100, Math.round((spendInTier / tierRange) * 100));
    nextTierAt = nextTier.minSpend;
  }

  // Calculate savings from reaching this tier
  // (what they would have paid at 30% vs what they pay now)
  const baseCost = monthlySpendCents / (1 + currentTier.markup / 100);
  const maxMarkupCost = baseCost * 1.30;
  const actualCost = baseCost * (1 + currentTier.markup / 100);
  const savingsThisMonth = Math.round(maxMarkupCost - actualCost);

  return {
    currentTier: currentTierIndex + 1,
    tierName: currentTier.name,
    markup: currentTier.markup,
    monthlySpendCents,
    nextTierAt,
    progressPercent,
    savingsThisMonth,
  };
}

/**
 * Get the start of the current billing month
 */
export function getBillingMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Format cents as currency string
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
```

---

### Task 3: Balance API Endpoint

Create endpoint to fetch user balance.

**File:** `app/api/billing/balance/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch balance
    const { data: balance, error: balanceError } = await supabase
      .from('balances')
      .select('amount_cents, updated_at')
      .eq('user_id', user.id)
      .single();

    if (balanceError) {
      // If no balance record, return 0
      if (balanceError.code === 'PGRST116') {
        return NextResponse.json({
          amountCents: 0,
          updatedAt: new Date().toISOString(),
        });
      }
      throw balanceError;
    }

    return NextResponse.json({
      amountCents: balance.amount_cents,
      updatedAt: balance.updated_at,
    });

  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
```

---

### Task 4: Transaction History API Endpoint

Create paginated transaction history endpoint.

**File:** `app/api/billing/transactions/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10))
    );
    const type = searchParams.get('type'); // Optional filter

    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    // Execute with pagination
    const { data: transactions, error, count } = await query
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const total = count || 0;

    return NextResponse.json({
      transactions: transactions?.map(t => ({
        id: t.id,
        type: t.type,
        amountCents: t.amount_cents,
        description: t.description,
        runId: t.run_id,
        stripePaymentId: t.stripe_payment_id,
        createdAt: t.created_at,
      })) || [],
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total,
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
```

---

### Task 5: User Tier API Endpoint

Create endpoint to get user's tier and progress.

**File:** `app/api/user/tier/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { calculateTier, getBillingMonthStart } from '@/lib/billing/tiers';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get monthly spend (sum of debits this month)
    const monthStart = getBillingMonthStart();

    const { data: spendData, error: spendError } = await supabase
      .from('transactions')
      .select('amount_cents')
      .eq('user_id', user.id)
      .eq('type', 'debit')
      .gte('created_at', monthStart.toISOString());

    if (spendError) throw spendError;

    // Calculate total spend (debits are stored as positive, so sum directly)
    const monthlySpendCents = spendData?.reduce(
      (sum, t) => sum + Math.abs(t.amount_cents),
      0
    ) || 0;

    const tier = calculateTier(monthlySpendCents);

    return NextResponse.json(tier);

  } catch (error) {
    console.error('Error fetching tier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tier' },
      { status: 500 }
    );
  }
}
```

---

### Task 6: Plan Switch API Endpoint

Create endpoint for switching between Managed and BYOK plans.

**File:** `app/api/plans/switch/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    const { targetPlan } = body as { targetPlan: 'managed' | 'byok' };

    if (!targetPlan || !['managed', 'byok'].includes(targetPlan)) {
      return NextResponse.json(
        { error: 'Invalid target plan' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan_type, stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    if (profile.plan_type === targetPlan) {
      return NextResponse.json(
        { error: 'Already on this plan' },
        { status: 400 }
      );
    }

    // Handle BYOK -> Managed switch
    if (profile.plan_type === 'byok' && targetPlan === 'managed') {
      // Get active subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('stripe_subscription_id, current_period_end')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (subscription?.stripe_subscription_id) {
        // Cancel subscription at period end
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });

        // Update local subscription record
        await supabase
          .from('subscriptions')
          .update({
            cancel_at: subscription.current_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.stripe_subscription_id);
      }

      // Update plan type (takes effect at period end, but UI shows pending)
      // Note: Actual plan change happens via webhook when subscription ends

      return NextResponse.json({
        success: true,
        message: 'Subscription will be cancelled at period end',
        periodEnd: subscription?.current_period_end,
      });
    }

    // Handle Managed -> BYOK switch
    if (profile.plan_type === 'managed' && targetPlan === 'byok') {
      // Get current balance for refund info
      const { data: balance } = await supabase
        .from('balances')
        .select('amount_cents')
        .eq('user_id', user.id)
        .single();

      // Return checkout URL for BYOK subscription
      // Actual plan switch happens after successful subscription
      const checkoutUrl = `/checkout/subscribe?switch=true&refund=${balance?.amount_cents || 0}`;

      return NextResponse.json({
        success: true,
        message: 'Redirect to BYOK checkout',
        checkoutUrl,
        pendingRefund: balance?.amount_cents || 0,
      });
    }

    return NextResponse.json(
      { error: 'Invalid plan transition' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error switching plans:', error);
    return NextResponse.json(
      { error: 'Failed to switch plans' },
      { status: 500 }
    );
  }
}
```

---

### Task 7: Stripe Customer Portal Endpoint

Create endpoint for Stripe Customer Portal session.

**File:** `app/api/billing/portal/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No payment method on file' },
        { status: 400 }
      );
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
```

---

### Task 8: Billing Data Hook

Create React hook for fetching billing data.

**File:** `lib/hooks/useBillingData.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { BillingData, UserBalance, Subscription, UserTier } from '@/lib/billing/types';

interface UseBillingDataResult {
  data: BillingData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useBillingData(): UseBillingDataResult {
  const [data, setData] = useState<BillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all billing data in parallel
      const [profileRes, balanceRes, tierRes, subscriptionRes] = await Promise.all([
        fetch('/api/user/profile'),
        fetch('/api/billing/balance'),
        fetch('/api/user/tier'),
        fetch('/api/billing/subscription'),
      ]);

      const profile = await profileRes.json();
      const balance = balanceRes.ok ? await balanceRes.json() : null;
      const tier = await tierRes.json();
      const subscription = subscriptionRes.ok ? await subscriptionRes.json() : null;

      setData({
        planType: profile.planType || 'managed',
        balance: balance as UserBalance | null,
        subscription: subscription as Subscription | null,
        tier: tier as UserTier,
      });

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch billing data'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
```

---

### Task 9: Transaction History Hook

Create hook with pagination for transactions.

**File:** `lib/hooks/useTransactions.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Transaction, TransactionPage } from '@/lib/billing/types';

interface UseTransactionsOptions {
  pageSize?: number;
  type?: string;
}

interface UseTransactionsResult {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refetch: () => Promise<void>;
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsResult {
  const { pageSize = 10, type } = options;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async (pageNum: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(pageNum),
        pageSize: String(pageSize),
      });

      if (type) {
        params.set('type', type);
      }

      const res = await fetch(`/api/billing/transactions?${params}`);

      if (!res.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data: TransactionPage = await res.json();

      setTransactions(data.transactions);
      setTotal(data.total);
      setPage(data.page);
      setHasMore(data.hasMore);

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, type]);

  useEffect(() => {
    fetchTransactions(page);
  }, [page, fetchTransactions]);

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, newPage));
  }, []);

  const nextPage = useCallback(() => {
    if (hasMore) {
      setPage(p => p + 1);
    }
  }, [hasMore]);

  const prevPage = useCallback(() => {
    setPage(p => Math.max(1, p - 1));
  }, []);

  return {
    transactions,
    total,
    page,
    pageSize,
    hasMore,
    isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    refetch: () => fetchTransactions(page),
  };
}
```

---

### Task 10: Balance Card Component

> **🎨 DESIGN SYSTEM REMINDER:** This card MUST use:
> - `glass-card` for the card container (NOT `bg-white dark:bg-gray-800`)
> - `gradient-brand-text` for the balance amount
> - `gradient-brand` for the "Add Credits" button
> - `text-white` for primary text, `text-white/50` for labels
> - Green (`text-green-400`) and red (`text-red-400`) for positive/negative indicators

Display current balance with add funds button.

**File:** `components/billing/BalanceCard.tsx`

```typescript
'use client';

import { useState } from 'react';
import { formatCents } from '@/lib/billing/tiers';
import { UserBalance } from '@/lib/billing/types';
import { AddCreditsModal } from './AddCreditsModal';

interface BalanceCardProps {
  balance: UserBalance | null;
  onRefresh: () => void;
}

export function BalanceCard({ balance, onRefresh }: BalanceCardProps) {
  const [showAddCredits, setShowAddCredits] = useState(false);

  const amountCents = balance?.amountCents ?? 0;
  const isLow = amountCents < 500; // Less than $5

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Balance
          </h3>
          {isLow && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Low Balance
            </span>
          )}
        </div>

        <div className="mb-4">
          <p className={`text-3xl font-bold ${
            isLow
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-gray-900 dark:text-white'
          }`}>
            {formatCents(amountCents)}
          </p>
          {balance?.updatedAt && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last updated: {new Date(balance.updatedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <button
          onClick={() => setShowAddCredits(true)}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Add Credits
        </button>
      </div>

      <AddCreditsModal
        isOpen={showAddCredits}
        onClose={() => setShowAddCredits(false)}
        currentBalance={amountCents}
        onSuccess={() => {
          setShowAddCredits(false);
          onRefresh();
        }}
      />
    </>
  );
}
```

---

### Task 11: Tier Progress Card Component

> **🎨 DESIGN SYSTEM REMINDER:** This card MUST use:
> - `glass-card` for the card container
> - `gradient-brand` for the progress bar fill
> - `text-h4 text-white` for the title
> - `text-white/70` for tier descriptions
> - `text-purple-400` for tier names/highlights
> - Purple accent colors for the tier badge

Display tier progress with visualization.

**File:** `components/billing/TierProgressCard.tsx`

```typescript
'use client';

import { UserTier, VOLUME_TIERS } from '@/lib/billing/types';
import { formatCents } from '@/lib/billing/tiers';

interface TierProgressCardProps {
  tier: UserTier;
}

export function TierProgressCard({ tier }: TierProgressCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Your Tier
        </h3>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
          {tier.tierName}
        </span>
      </div>

      <div className="space-y-4">
        {/* Current markup */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Current markup</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {tier.markup}%
            </span>
          </div>
        </div>

        {/* Monthly spend */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">This month's spend</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCents(tier.monthlySpendCents)}
            </span>
          </div>
        </div>

        {/* Progress bar to next tier */}
        {tier.nextTierAt !== null && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">
                Progress to next tier
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {formatCents(tier.nextTierAt - tier.monthlySpendCents)} to go
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${tier.progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Next tier: {VOLUME_TIERS[tier.currentTier]?.name || 'Max tier reached'}
              ({VOLUME_TIERS[tier.currentTier]?.markup || tier.markup}% markup)
            </p>
          </div>
        )}

        {/* Savings */}
        {tier.savingsThisMonth > 0 && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Savings this month
              </span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {formatCents(tier.savingsThisMonth)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Task 12: Transaction History Component

> **🎨 DESIGN SYSTEM REMINDER:** This component MUST use:
> - `glass-card` for the outer container
> - `border-white/10` for dividers (NOT `divide-gray-200`)
> - `text-white` for primary text, `text-white/50` for labels
> - `text-green-400` for credits, `text-red-400` for debits
> - `hover:bg-white/5` for row hover states
> - `text-purple-400` for pagination controls

Display paginated transaction history.

**File:** `components/billing/TransactionHistory.tsx`

```typescript
'use client';

import { useTransactions } from '@/lib/hooks/useTransactions';
import { formatCents } from '@/lib/billing/tiers';
import { Transaction } from '@/lib/billing/types';

interface TransactionHistoryProps {
  pageSize?: number;
}

const TYPE_LABELS: Record<Transaction['type'], string> = {
  credit: 'Added credits',
  debit: 'Flow run',
  refund: 'Refund',
  gift_sent: 'Gift sent',
  gift_received: 'Gift received',
  referral_bonus: 'Referral bonus',
};

const TYPE_COLORS: Record<Transaction['type'], string> = {
  credit: 'text-green-600 dark:text-green-400',
  debit: 'text-red-600 dark:text-red-400',
  refund: 'text-green-600 dark:text-green-400',
  gift_sent: 'text-red-600 dark:text-red-400',
  gift_received: 'text-green-600 dark:text-green-400',
  referral_bonus: 'text-green-600 dark:text-green-400',
};

export function TransactionHistory({ pageSize = 10 }: TransactionHistoryProps) {
  const {
    transactions,
    total,
    page,
    hasMore,
    isLoading,
    error,
    nextPage,
    prevPage,
  } = useTransactions({ pageSize });

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-red-600 dark:text-red-400">
        Failed to load transactions. Please try again.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transaction History
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {total} transactions
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {isLoading ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            No transactions yet
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {tx.description || TYPE_LABELS[tx.type]}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(tx.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className={`font-medium ${TYPE_COLORS[tx.type]}`}>
                {tx.type === 'debit' || tx.type === 'gift_sent' ? '-' : '+'}
                {formatCents(Math.abs(tx.amountCents))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={prevPage}
            disabled={page === 1}
            className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <button
            onClick={nextPage}
            disabled={!hasMore}
            className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### Task 13: Plan Card Component

> **🎨 DESIGN SYSTEM REMINDER:** This card MUST use:
> - `glass-card` for the card container
> - `text-h4 text-white` for the title
> - `gradient-brand-text` for the plan price
> - `text-white/70` for descriptions
> - Status badges: `badge badge-warning` for "Cancelling"
> - Secondary button: `border-white/20 text-white/80`

Display current plan with switch option.

**File:** `components/billing/PlanCard.tsx`

```typescript
'use client';

import { useState } from 'react';
import { PlanType, Subscription } from '@/lib/billing/types';
import { PlanSwitchModal } from './PlanSwitchModal';

interface PlanCardProps {
  planType: PlanType;
  subscription: Subscription | null;
  balanceCents: number;
  onPlanChange: () => void;
}

export function PlanCard({ planType, subscription, balanceCents, onPlanChange }: PlanCardProps) {
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  const isByok = planType === 'byok';
  const isPendingCancel = subscription?.cancelAt != null;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Current Plan
          </h3>
          {isPendingCancel && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Cancelling
            </span>
          )}
        </div>

        <div className="mb-6">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {isByok ? 'BYOK' : 'Managed'}
            </span>
            {isByok && (
              <span className="text-lg text-gray-600 dark:text-gray-400">
                $10/month
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {isByok
              ? 'Bring Your Own Keys - 0% markup'
              : 'Pay-as-you-go with volume discounts'
            }
          </p>

          {subscription && (
            <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {isPendingCancel ? (
                <p>
                  Access until: {new Date(subscription.cancelAt!).toLocaleDateString()}
                </p>
              ) : (
                <p>
                  Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setShowSwitchModal(true)}
            disabled={isPendingCancel}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isByok ? 'Switch to Managed' : 'Switch to BYOK'}
          </button>
        </div>
      </div>

      <PlanSwitchModal
        isOpen={showSwitchModal}
        onClose={() => setShowSwitchModal(false)}
        currentPlan={planType}
        balanceCents={balanceCents}
        subscription={subscription}
        onSuccess={() => {
          setShowSwitchModal(false);
          onPlanChange();
        }}
      />
    </>
  );
}
```

---

### Task 14: Plan Switch Modal Component

> **🎨 DESIGN SYSTEM REMINDER:** This modal MUST use:
> - `glass-card` for Dialog.Panel
> - `text-h4 text-white` for the title
> - `glass-subtle` for comparison table background
> - `border-white/10` for table borders
> - `text-white` for table content, `text-white/70` for headers
> - `gradient-brand` for primary action button
> - `text-white/80` for cancel button

Modal for confirming plan switch.

**File:** `components/billing/PlanSwitchModal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@headlessui/react';
import { formatCents } from '@/lib/billing/tiers';
import { PlanType, Subscription } from '@/lib/billing/types';

interface PlanSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanType;
  balanceCents: number;
  subscription: Subscription | null;
  onSuccess: () => void;
}

export function PlanSwitchModal({
  isOpen,
  onClose,
  currentPlan,
  balanceCents,
  subscription,
  onSuccess,
}: PlanSwitchModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchingToByok = currentPlan === 'managed';
  const targetPlan = switchingToByok ? 'byok' : 'managed';

  const handleSwitch = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/plans/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlan }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to switch plans');
      }

      if (data.checkoutUrl) {
        // Redirect to BYOK checkout
        router.push(data.checkoutUrl);
      } else {
        onSuccess();
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          <div className="p-6">
            <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Switch to {switchingToByok ? 'BYOK' : 'Managed'} Plan
            </Dialog.Title>

            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                {switchingToByok
                  ? "You're switching from Managed to BYOK ($10/month)."
                  : "You're switching from BYOK to Managed (pay-as-you-go)."
                }
              </p>

              {/* Comparison table */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                        Before ({currentPlan})
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                        After ({targetPlan})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">
                        {switchingToByok ? 'We provide API keys' : 'You provide API keys'}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">
                        {switchingToByok ? 'You provide API keys' : 'We provide API keys'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">
                        {switchingToByok ? 'Pay per token + markup' : '$10/mo + your API'}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">
                        {switchingToByok ? '$10/mo + your API' : 'Pay per token + markup'}
                      </td>
                    </tr>
                    {switchingToByok && balanceCents > 0 && (
                      <tr>
                        <td className="px-4 py-2 text-gray-900 dark:text-white">
                          Balance: {formatCents(balanceCents)}
                        </td>
                        <td className="px-4 py-2 text-gray-900 dark:text-white">
                          Balance refunded*
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Refund note */}
              {switchingToByok && balanceCents > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  * Your remaining balance of {formatCents(balanceCents)} will be refunded
                  to your original payment method within 5-10 business days.
                </p>
              )}

              {/* BYOK to Managed: subscription info */}
              {!switchingToByok && subscription && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your BYOK subscription will be cancelled. You'll retain access until{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                  Your stored API keys will be removed for security.
                </p>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSwitch}
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4\" viewBox=\"0 0 24 24\">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {switchingToByok ? 'Continue to Checkout' : 'Switch & Add Funds'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
```

---

### Task 15: Insufficient Balance Modal Component

> **🎨 DESIGN SYSTEM REMINDER:** This modal MUST use:
> - `glass-card` for Dialog.Panel
> - `text-h4 text-white` for the title
> - `glass-subtle` for cost breakdown box
> - `text-white` for amounts, `text-white/50` for labels
> - `text-red-400` for shortfall amount
> - `gradient-brand` for "Add Credits" button
> - Close button: `text-white/50 hover:text-white`

Modal shown when user tries to run a flow without sufficient balance.

**File:** `components/billing/InsufficientBalanceModal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { formatCents } from '@/lib/billing/tiers';
import { AddCreditsModal } from './AddCreditsModal';

interface CostBreakdown {
  modelName: string;
  estimatedCost: number;
}

interface InsufficientBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  estimatedCost: number;
  costBreakdown?: CostBreakdown[];
  onCreditsAdded: () => void;
}

export function InsufficientBalanceModal({
  isOpen,
  onClose,
  currentBalance,
  estimatedCost,
  costBreakdown = [],
  onCreditsAdded,
}: InsufficientBalanceModalProps) {
  const [showAddCredits, setShowAddCredits] = useState(false);

  const shortfall = Math.max(0, estimatedCost - currentBalance);
  const recommendedAmount = Math.max(1000, shortfall + 500); // At least $10 or shortfall + $5

  if (showAddCredits) {
    return (
      <AddCreditsModal
        isOpen={true}
        onClose={() => {
          setShowAddCredits(false);
          onClose();
        }}
        currentBalance={currentBalance}
        suggestedAmount={recommendedAmount}
        onSuccess={() => {
          setShowAddCredits(false);
          onCreditsAdded();
        }}
      />
    );
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                Add Credits to Run
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your balance is too low to run this flow.
            </p>

            {/* Cost breakdown */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Current balance</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCents(currentBalance)}
                </span>
              </div>

              {costBreakdown.length > 0 && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Estimated cost breakdown:
                    </p>
                    {costBreakdown.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {item.modelName}
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          ~{formatCents(item.estimatedCost)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total estimate</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ~{formatCents(estimatedCost)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-sm font-medium">
                <span className="text-red-600 dark:text-red-400">Shortfall</span>
                <span className="text-red-600 dark:text-red-400">
                  ~{formatCents(shortfall)}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              We recommend adding at least {formatCents(recommendedAmount)} to cover this
              and future runs.
            </p>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowAddCredits(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Add Credits
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
```

---

### Task 16: Add Credits Modal Component

> **🎨 DESIGN SYSTEM REMINDER:** This modal MUST use:
> - `glass-card` for Dialog.Panel
> - `text-h4 text-white` for the title
> - `glass-subtle border-white/10` for the amount input
> - `glass-subtle` for fee breakdown box
> - `text-white` for amounts, `text-white/50` for labels
> - `text-green-400` for new balance
> - `gradient-brand` for "Continue" button
> - Error messages: `glass border-red-500/30 text-red-400`

Modal for adding credits to balance.

**File:** `components/billing/AddCreditsModal.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@headlessui/react';
import { formatCents } from '@/lib/billing/tiers';

interface AddCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  suggestedAmount?: number;
  onSuccess: () => void;
}

const MIN_AMOUNT = 1000; // $10
const MAX_AMOUNT = 100000; // $1,000

// Stripe fee calculation (2.9% + $0.30)
function calculateFees(amountCents: number): { fee: number; total: number } {
  const percentFee = Math.round(amountCents * 0.029);
  const fixedFee = 30;
  const fee = percentFee + fixedFee;
  return { fee, total: amountCents + fee };
}

export function AddCreditsModal({
  isOpen,
  onClose,
  currentBalance,
  suggestedAmount,
  onSuccess,
}: AddCreditsModalProps) {
  const router = useRouter();
  const [amountCents, setAmountCents] = useState(suggestedAmount || 2500);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset amount when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmountCents(suggestedAmount || 2500);
      setError(null);
    }
  }, [isOpen, suggestedAmount]);

  const { fee, total } = calculateFees(amountCents);
  const newBalance = currentBalance + amountCents;

  const isValidAmount = amountCents >= MIN_AMOUNT && amountCents <= MAX_AMOUNT;

  const handleAmountChange = (value: string) => {
    // Parse dollar input to cents
    const dollars = parseFloat(value) || 0;
    const cents = Math.round(dollars * 100);
    setAmountCents(cents);
  };

  const handleSubmit = async () => {
    if (!isValidAmount) return;

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        router.push(data.url);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                Add Credits
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {currentBalance > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Current balance: {formatCents(currentBalance)}
              </p>
            )}

            {/* Amount input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  min={MIN_AMOUNT / 100}
                  max={MAX_AMOUNT / 100}
                  step="0.01"
                  value={(amountCents / 100).toFixed(2)}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Minimum ${MIN_AMOUNT / 100} - Maximum ${(MAX_AMOUNT / 100).toLocaleString()}
              </p>
            </div>

            {/* Fee breakdown */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Credits to account</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCents(amountCents)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Processing fee (2.9%)</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCents(Math.round(amountCents * 0.029))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Fixed fee</span>
                <span className="text-gray-900 dark:text-white">$0.30</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                <div className="flex justify-between font-medium">
                  <span className="text-gray-900 dark:text-white">Total charge</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCents(total)}
                  </span>
                </div>
              </div>
              {currentBalance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">New balance</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {formatCents(newBalance)}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Tip: Adding more at once means lower fees per dollar.
            </p>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !isValidAmount}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Continue
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
```

---

### Task 17: Billing Settings Page

> **🎨 DESIGN SYSTEM REMINDER:** This page MUST use:
> - `bg-[var(--bg-base)]` for page background
> - `text-h2 text-white` for page title
> - `glass-subtle` for skeleton loading states (NOT `bg-gray-200`)
> - `glass border-red-500/30` for error states
> - `gradient-brand` for retry buttons
> - All child components must follow their respective design system requirements

Main billing settings page assembling all components.

**File:** `app/settings/billing/page.tsx`

```typescript
'use client';

import { useBillingData } from '@/lib/hooks/useBillingData';
import { BalanceCard } from '@/components/billing/BalanceCard';
import { TierProgressCard } from '@/components/billing/TierProgressCard';
import { PlanCard } from '@/components/billing/PlanCard';
import { TransactionHistory } from '@/components/billing/TransactionHistory';

export default function BillingSettingsPage() {
  const { data, isLoading, error, refetch } = useBillingData();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
            Failed to load billing data
          </h2>
          <p className="text-red-500 dark:text-red-300 mb-4">
            {error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isManaged = data.planType === 'managed';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Billing & Usage
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Plan card */}
        <PlanCard
          planType={data.planType}
          subscription={data.subscription}
          balanceCents={data.balance?.amountCents || 0}
          onPlanChange={refetch}
        />

        {/* Balance or Subscription status */}
        {isManaged ? (
          <BalanceCard
            balance={data.balance}
            onRefresh={refetch}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Subscription Status
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span className="font-medium text-green-600 dark:text-green-400 capitalize">
                  {data.subscription?.status || 'Active'}
                </span>
              </div>
              {data.subscription?.currentPeriodEnd && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Next billing</span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={async () => {
                const res = await fetch('/api/billing/portal', { method: 'POST' });
                const { url } = await res.json();
                if (url) window.location.href = url;
              }}
              className="w-full mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Manage Payment Method
            </button>
          </div>
        )}
      </div>

      {/* Tier progress (Managed only) */}
      {isManaged && data.tier && (
        <div className="mb-8">
          <TierProgressCard tier={data.tier} />
        </div>
      )}

      {/* Transaction history */}
      <TransactionHistory pageSize={10} />
    </div>
  );
}
```

---

### Task 18: Balance Check Before Flow Run

Utility function to check balance before running a flow.

**File:** `lib/billing/balance-check.ts`

```typescript
import { createClient } from '@/lib/supabase/client';

export interface BalanceCheckResult {
  hasEnough: boolean;
  currentBalance: number;
  estimatedCost: number;
  shortfall: number;
  costBreakdown: Array<{
    modelName: string;
    estimatedCost: number;
  }>;
}

interface ModelCostEstimate {
  modelId: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
}

// Pricing per 1M tokens (in cents) - example values
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-opus': { input: 1500, output: 7500 },
  'claude-3-sonnet': { input: 300, output: 1500 },
  'claude-3-haiku': { input: 25, output: 125 },
  'gpt-4-turbo': { input: 1000, output: 3000 },
  'gpt-4o': { input: 500, output: 1500 },
  'gpt-3.5-turbo': { input: 50, output: 150 },
  'gemini-pro': { input: 50, output: 150 },
  'gemini-ultra': { input: 1000, output: 3000 },
};

/**
 * Estimate cost for a model based on expected tokens
 */
function estimateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  markup: number
): number {
  const pricing = MODEL_PRICING[modelId] || { input: 100, output: 300 };

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const baseCost = inputCost + outputCost;

  // Apply markup
  const totalCost = baseCost * (1 + markup / 100);

  return Math.ceil(totalCost);
}

/**
 * Check if user has sufficient balance to run a flow
 */
export async function checkBalanceForRun(
  models: ModelCostEstimate[],
  rounds: number = 2
): Promise<BalanceCheckResult> {
  const supabase = createClient();

  // Get user profile and balance
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const [profileRes, balanceRes, tierRes] = await Promise.all([
    supabase.from('profiles').select('plan_type').eq('id', user.id).single(),
    supabase.from('balances').select('amount_cents').eq('user_id', user.id).single(),
    fetch('/api/user/tier').then(r => r.json()),
  ]);

  // BYOK users don't need balance
  if (profileRes.data?.plan_type === 'byok') {
    return {
      hasEnough: true,
      currentBalance: 0,
      estimatedCost: 0,
      shortfall: 0,
      costBreakdown: [],
    };
  }

  const currentBalance = balanceRes.data?.amount_cents || 0;
  const markup = tierRes.markup || 30;

  // Calculate cost for each model
  const costBreakdown = models.map(model => {
    // Multiply by rounds for multi-round flows
    const cost = estimateModelCost(
      model.modelId,
      model.inputTokens * rounds,
      model.outputTokens * rounds,
      markup
    );

    return {
      modelName: model.modelName,
      estimatedCost: cost,
    };
  });

  const estimatedCost = costBreakdown.reduce((sum, item) => sum + item.estimatedCost, 0);
  const shortfall = Math.max(0, estimatedCost - currentBalance);

  return {
    hasEnough: currentBalance >= estimatedCost,
    currentBalance,
    estimatedCost,
    shortfall,
    costBreakdown,
  };
}
```

---

### Task 19: Integration with Flow Runner

Hook to use balance check in flow runner.

**File:** `lib/hooks/useBalanceCheck.ts`

```typescript
'use client';

import { useState, useCallback } from 'react';
import { checkBalanceForRun, BalanceCheckResult } from '@/lib/billing/balance-check';

interface ModelConfig {
  modelId: string;
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface UseBalanceCheckResult {
  checkBalance: (models: ModelConfig[], rounds?: number) => Promise<BalanceCheckResult>;
  result: BalanceCheckResult | null;
  isChecking: boolean;
  error: Error | null;
}

// Default token estimates based on typical flow usage
const DEFAULT_INPUT_TOKENS = 2000;
const DEFAULT_OUTPUT_TOKENS = 1000;

export function useBalanceCheck(): UseBalanceCheckResult {
  const [result, setResult] = useState<BalanceCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkBalance = useCallback(async (
    models: ModelConfig[],
    rounds: number = 2
  ): Promise<BalanceCheckResult> => {
    try {
      setIsChecking(true);
      setError(null);

      const modelEstimates = models.map(model => ({
        modelId: model.modelId,
        modelName: model.modelName,
        inputTokens: model.inputTokens || DEFAULT_INPUT_TOKENS,
        outputTokens: model.outputTokens || DEFAULT_OUTPUT_TOKENS,
      }));

      const checkResult = await checkBalanceForRun(modelEstimates, rounds);
      setResult(checkResult);
      return checkResult;

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Balance check failed');
      setError(errorObj);
      throw errorObj;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { checkBalance, result, isChecking, error };
}
```

---

### Task 20: Auto-Refill Settings Database & API

Create the auto-refill settings table and API endpoints.

**Database Migration (add to Plan 1 or run separately):**

```sql
-- Auto-refill settings table (per user story Flow 14)
CREATE TABLE IF NOT EXISTS public.auto_refill_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  threshold_cents INTEGER DEFAULT 500 CHECK (threshold_cents >= 100), -- Minimum $1
  refill_amount_cents INTEGER DEFAULT 2500 CHECK (refill_amount_cents >= 1000), -- Minimum $10
  max_refills_per_day INTEGER DEFAULT 3 CHECK (max_refills_per_day BETWEEN 1 AND 10),
  last_refill_at TIMESTAMPTZ,
  refills_today INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.auto_refill_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auto_refill_settings"
  ON public.auto_refill_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own auto_refill_settings"
  ON public.auto_refill_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auto_refill_settings"
  ON public.auto_refill_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for quick lookups
CREATE INDEX idx_auto_refill_user ON public.auto_refill_settings(user_id);
CREATE INDEX idx_auto_refill_enabled ON public.auto_refill_settings(enabled) WHERE enabled = TRUE;
```

**File:** `app/api/billing/auto-refill/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// GET auto-refill settings
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings, error } = await supabase
      .from('auto_refill_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return defaults if no settings exist
    return NextResponse.json(settings || {
      enabled: false,
      thresholdCents: 500,
      refillAmountCents: 2500,
      maxRefillsPerDay: 3,
    });

  } catch (error) {
    console.error('Error fetching auto-refill settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST/PUT update auto-refill settings
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { enabled, thresholdCents, refillAmountCents, maxRefillsPerDay } = body;

    // Validation
    if (thresholdCents !== undefined && thresholdCents < 100) {
      return NextResponse.json({ error: 'Threshold must be at least $1' }, { status: 400 });
    }
    if (refillAmountCents !== undefined && refillAmountCents < 1000) {
      return NextResponse.json({ error: 'Refill amount must be at least $10' }, { status: 400 });
    }
    if (maxRefillsPerDay !== undefined && (maxRefillsPerDay < 1 || maxRefillsPerDay > 10)) {
      return NextResponse.json({ error: 'Max refills must be between 1 and 10' }, { status: 400 });
    }

    // Upsert settings
    const { data, error } = await supabase
      .from('auto_refill_settings')
      .upsert({
        user_id: user.id,
        enabled: enabled ?? false,
        threshold_cents: thresholdCents ?? 500,
        refill_amount_cents: refillAmountCents ?? 2500,
        max_refills_per_day: maxRefillsPerDay ?? 3,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      enabled: data.enabled,
      thresholdCents: data.threshold_cents,
      refillAmountCents: data.refill_amount_cents,
      maxRefillsPerDay: data.max_refills_per_day,
    });

  } catch (error) {
    console.error('Error updating auto-refill settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
```

---

### Task 21: Auto-Refill Settings Component

UI component for managing auto-refill settings in billing page.

**File:** `components/billing/AutoRefillSettings.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { formatCents } from '@/lib/billing/tiers';

interface AutoRefillSettingsProps {
  hasPaymentMethod: boolean;
}

interface Settings {
  enabled: boolean;
  thresholdCents: number;
  refillAmountCents: number;
  maxRefillsPerDay: number;
}

const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  thresholdCents: 500,
  refillAmountCents: 2500,
  maxRefillsPerDay: 3,
};

const THRESHOLD_OPTIONS = [
  { value: 500, label: '$5' },
  { value: 1000, label: '$10' },
  { value: 2500, label: '$25' },
  { value: 5000, label: '$50' },
];

const REFILL_AMOUNT_OPTIONS = [
  { value: 1000, label: '$10' },
  { value: 2500, label: '$25' },
  { value: 5000, label: '$50' },
  { value: 10000, label: '$100' },
];

export function AutoRefillSettings({ hasPaymentMethod }: AutoRefillSettingsProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/billing/auto-refill');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch auto-refill settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<Settings>) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      const updatedSettings = { ...settings, ...newSettings };

      const res = await fetch('/api/billing/auto-refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      const data = await res.json();
      setSettings(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Auto-Refill
        </h3>
        {success && (
          <span className="text-sm text-green-600 dark:text-green-400">
            Settings saved!
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Automatically add credits when your balance falls below a threshold.
      </p>

      {!hasPaymentMethod && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-lg text-sm">
          Add a payment method to enable auto-refill.
        </div>
      )}

      {/* Enable toggle */}
      <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Enable auto-refill</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Automatically top up when balance is low
          </p>
        </div>
        <button
          onClick={() => saveSettings({ enabled: !settings.enabled })}
          disabled={!hasPaymentMethod || isSaving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            settings.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Threshold setting */}
      <div className="py-3 border-b border-gray-200 dark:border-gray-700">
        <label className="block font-medium text-gray-900 dark:text-white mb-2">
          Refill when balance falls below
        </label>
        <select
          value={settings.thresholdCents}
          onChange={(e) => saveSettings({ thresholdCents: parseInt(e.target.value) })}
          disabled={!settings.enabled || isSaving}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
        >
          {THRESHOLD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Refill amount setting */}
      <div className="py-3 border-b border-gray-200 dark:border-gray-700">
        <label className="block font-medium text-gray-900 dark:text-white mb-2">
          Amount to add
        </label>
        <select
          value={settings.refillAmountCents}
          onChange={(e) => saveSettings({ refillAmountCents: parseInt(e.target.value) })}
          disabled={!settings.enabled || isSaving}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
        >
          {REFILL_AMOUNT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Max refills per day */}
      <div className="py-3">
        <label className="block font-medium text-gray-900 dark:text-white mb-2">
          Maximum refills per day
        </label>
        <select
          value={settings.maxRefillsPerDay}
          onChange={(e) => saveSettings({ maxRefillsPerDay: parseInt(e.target.value) })}
          disabled={!settings.enabled || isSaving}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
        >
          {[1, 2, 3, 5, 10].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'refill' : 'refills'}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Safety limit to prevent unexpected charges
        </p>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {settings.enabled && (
        <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm">
          Your card will be charged {formatCents(settings.refillAmountCents)} when your balance
          drops below {formatCents(settings.thresholdCents)}, up to {settings.maxRefillsPerDay} times per day.
        </div>
      )}
    </div>
  );
}
```

---

## Verification Checklist

After completing all tasks, verify:

| Check | Command/Action | Expected Result |
|-------|----------------|-----------------|
| Balance API | `curl /api/billing/balance` | Returns balance object |
| Transactions API | `curl /api/billing/transactions?page=1` | Returns paginated transactions |
| Tier API | `curl /api/user/tier` | Returns tier info with progress |
| Plan switch (BYOK->Managed) | Click "Switch to Managed" | Shows confirmation, cancels subscription |
| Plan switch (Managed->BYOK) | Click "Switch to BYOK" | Redirects to checkout |
| Billing page loads | Navigate to /settings/billing | Shows balance, plan, tier, transactions |
| Add credits modal | Click "Add Credits" | Shows modal with fee breakdown |
| Insufficient balance modal | Try to run with low balance | Shows cost breakdown and shortfall |
| Transaction pagination | Click next/prev | Loads correct page |
| Tier progress display | View tier card | Shows progress bar and savings |
| Stripe Portal | Click "Manage Payment Method" | Redirects to Stripe portal |
| Auto-refill API GET | `curl /api/billing/auto-refill` | Returns settings object |
| Auto-refill API POST | Update settings | Saves and returns updated settings |
| Auto-refill toggle | Enable/disable auto-refill | Toggle state updates |
| Auto-refill settings | Change threshold/amount | Settings persist across page reloads |

---

## Deliverables

| Deliverable | Location |
|-------------|----------|
| Billing types | `lib/billing/types.ts` |
| Tier calculation | `lib/billing/tiers.ts` |
| Balance API | `app/api/billing/balance/route.ts` |
| Transactions API | `app/api/billing/transactions/route.ts` |
| Tier API | `app/api/user/tier/route.ts` |
| Plan switch API | `app/api/plans/switch/route.ts` |
| Portal API | `app/api/billing/portal/route.ts` |
| Billing data hook | `lib/hooks/useBillingData.ts` |
| Transactions hook | `lib/hooks/useTransactions.ts` |
| Balance check hook | `lib/hooks/useBalanceCheck.ts` |
| Balance Card | `components/billing/BalanceCard.tsx` |
| Tier Progress Card | `components/billing/TierProgressCard.tsx` |
| Transaction History | `components/billing/TransactionHistory.tsx` |
| Plan Card | `components/billing/PlanCard.tsx` |
| Plan Switch Modal | `components/billing/PlanSwitchModal.tsx` |
| Insufficient Balance Modal | `components/billing/InsufficientBalanceModal.tsx` |
| Add Credits Modal | `components/billing/AddCreditsModal.tsx` |
| Billing Settings Page | `app/settings/billing/page.tsx` |
| Auto-refill settings table | SQL migration (add to Plan 1 or separate) |
| Auto-refill API | `app/api/billing/auto-refill/route.ts` |
| Auto-refill Component | `components/billing/AutoRefillSettings.tsx` |

---

## Next Steps

After Plan 3 is complete:
- **Plan 4: Subscription Lifecycle** - Cancel/pause subscription, delete account, payment failure handling, card expiring recovery
- **Plan 5: Security Hardening** - Rate limiting (Upstash Redis), CSRF protection, fraud prevention, webhook reconciliation, audit logging
- **Plan 6: BYOK and Social** - API key encryption (AES-256-GCM), OpenRouter OAuth, gift sending/claiming, referral system, chargeback handling

---

## Troubleshooting

### Balance not updating after payment

- Check `processed_webhooks` table for the event
- Verify webhook endpoint is receiving events
- Check Stripe Dashboard for webhook delivery status

### Tier calculation incorrect

- Verify `transactions` table has correct `created_at` timestamps
- Check that debits are being recorded with correct amounts
- Ensure month boundary calculation uses correct timezone

### Plan switch not working

- Verify user has `stripe_customer_id` in profile
- Check Stripe subscription status
- Ensure webhook is processing `customer.subscription.deleted` events

### Stripe Portal not opening

- Verify `NEXT_PUBLIC_APP_URL` is set correctly
- Check that customer has payment methods on file
- Ensure Stripe Portal is configured in Stripe Dashboard

---

## ⛔ DESIGN SYSTEM VERIFICATION CHECKLIST

> **MANDATORY:** Before marking this plan as complete, verify EVERY item below.
> **Failure to follow the design system will result in costly UI rewrites.**

### Global Checks

| Requirement | Verification |
|-------------|--------------|
| Read DESIGN_SYSTEM.md | ☐ Completed before implementation |
| Read DESIGN_TOKENS.md | ☐ Completed before implementation |
| No generic Tailwind for styled elements | ☐ No `bg-gray-*`, `bg-white`, `border-gray-*`, `text-gray-*` |
| Dark theme colors used | ☐ All backgrounds use `glass-*` classes or CSS vars |

### Component-by-Component Checklist

**Balance Card (Task 10)**
- ☐ Card container uses `glass-card` (NOT `bg-white dark:bg-gray-800`)
- ☐ Balance amount uses `gradient-brand-text`
- ☐ "Add Credits" button uses `gradient-brand`
- ☐ Labels use `text-white/50`, values use `text-white`
- ☐ Positive changes use `text-green-400`, negative use `text-red-400`

**Tier Progress Card (Task 11)**
- ☐ Card container uses `glass-card`
- ☐ Progress bar fill uses `gradient-brand`
- ☐ Title uses `text-h4 text-white`
- ☐ Tier name/badge uses purple accent (`text-purple-400`)

**Transaction History (Task 12)**
- ☐ Outer container uses `glass-card`
- ☐ Row dividers use `divide-white/10` (NOT `divide-gray-200`)
- ☐ Row hover uses `hover:bg-white/5`
- ☐ Credits use `text-green-400`, debits use `text-red-400`
- ☐ Pagination controls use `text-purple-400`

**Plan Card (Task 13)**
- ☐ Card container uses `glass-card`
- ☐ Plan price uses `gradient-brand-text`
- ☐ Status badges use design system badge classes
- ☐ Switch button uses `border-white/20 text-white/80`

**Plan Switch Modal (Task 14)**
- ☐ Dialog.Panel uses `glass-card`
- ☐ Comparison table uses `glass-subtle` background
- ☐ Table borders use `border-white/10`
- ☐ Primary action uses `gradient-brand`
- ☐ Error messages use `glass border-red-500/30 text-red-400`

**Insufficient Balance Modal (Task 15)**
- ☐ Dialog.Panel uses `glass-card`
- ☐ Cost breakdown uses `glass-subtle`
- ☐ Shortfall amount uses `text-red-400`
- ☐ "Add Credits" button uses `gradient-brand`

**Add Credits Modal (Task 16)**
- ☐ Dialog.Panel uses `glass-card`
- ☐ Amount input uses `glass-subtle border-white/10`
- ☐ Fee breakdown uses `glass-subtle`
- ☐ New balance uses `text-green-400`
- ☐ "Continue" button uses `gradient-brand`
- ☐ Error messages use `glass border-red-500/30 text-red-400`

**Billing Settings Page (Task 17)**
- ☐ Page background uses `bg-[var(--bg-base)]`
- ☐ Page title uses `text-h2 text-white`
- ☐ Skeleton states use `glass-subtle` (NOT `bg-gray-200`)
- ☐ Error states use `glass border-red-500/30`

**Auto-Refill Settings (Task 21)**
- ☐ Card container uses `glass-card`
- ☐ Toggle uses purple colors when enabled
- ☐ Select inputs use `glass-subtle border-white/10`
- ☐ Warning box uses amber design system colors
- ☐ Info box uses purple/indigo accent

### Forbidden Patterns

The following patterns are **NEVER** acceptable in UI components:

```tsx
// ❌ WRONG - Generic backgrounds
className="bg-white dark:bg-gray-800"
className="bg-gray-50 dark:bg-gray-700/50"

// ✅ CORRECT - Design system backgrounds
className="glass-card"
className="glass-subtle"

// ❌ WRONG - Generic text colors
className="text-gray-900 dark:text-white"
className="text-gray-600 dark:text-gray-400"
className="text-gray-500 dark:text-gray-400"

// ✅ CORRECT - Design system text colors
className="text-white"
className="text-white/70"
className="text-white/50"

// ❌ WRONG - Generic borders
className="border-gray-200 dark:border-gray-700"
className="divide-gray-200 dark:divide-gray-700"

// ✅ CORRECT - Design system borders
className="border-white/10"
className="divide-white/10"

// ❌ WRONG - Generic buttons
className="bg-indigo-600 hover:bg-indigo-700"

// ✅ CORRECT - Design system buttons
className="gradient-brand hover:shadow-purple-500/40"
```

---

**Sign-off Required:** This plan cannot be marked complete until a code reviewer has verified all design system requirements are met.

---

## Master Checklist

### Instructions for Claude Code

> **CRITICAL: You must follow these rules exactly.**
>
> 1. **Save after every cell write.** You cannot batch writes to this table. Each time you update a cell (start time, end time, estimate, etc.), you must save the file immediately before proceeding to other cells or other work.
>
> 2. **Check the checkbox** when you begin a task. This serves as a visual indicator of which task is currently in progress.
>
> 3. **Workflow for each task:**
>    - Check the checkbox `[x]` -> Save
>    - Write start time -> Save
>    - Complete the implementation work
>    - Write end time -> Save
>    - Calculate and write total time -> Save
>    - Write human time estimate -> Save
>    - Calculate and write multiplier -> Save
>    - Move to next task
>
> 4. **Time format:** Use `HH:MM` (24-hour format) for start/end times. Use minutes for total time and estimates.
>
> 5. **Multiplier calculation:** `Multiplier = Human Estimate / Total Time`. Express as `Nx` (e.g., `10x` means 10 times faster than human estimate).
>
> 6. **If blocked:** Note the blocker in the task description section below and move to the next unblocked task.

### Progress Dashboard

| Done | # | Task Name | Start | End | Total (min) | Human Est. (min) | Multiplier |
|:----:|:-:|-----------|:-----:|:---:|:-----------:|:----------------:|:----------:|
| [ ] | 1 | Billing Types and Constants | | | | 30 | |
| [ ] | 2 | Tier Calculation Logic | | | | 45 | |
| [ ] | 3 | Balance API Endpoint | | | | 30 | |
| [ ] | 4 | Transaction History API | | | | 45 | |
| [ ] | 5 | User Tier API Endpoint | | | | 30 | |
| [ ] | 6 | Plan Switch API Endpoint | | | | 60 | |
| [ ] | 7 | Stripe Portal Endpoint | | | | 20 | |
| [ ] | 8 | Billing Data Hook | | | | 30 | |
| [ ] | 9 | Transaction History Hook | | | | 30 | |
| [ ] | 10 | Balance Card Component | | | | 45 | |
| [ ] | 11 | Tier Progress Card | | | | 45 | |
| [ ] | 12 | Transaction History Component | | | | 60 | |
| [ ] | 13 | Plan Card Component | | | | 45 | |
| [ ] | 14 | Plan Switch Modal | | | | 60 | |
| [ ] | 15 | Insufficient Balance Modal | | | | 60 | |
| [ ] | 16 | Add Credits Modal | | | | 60 | |
| [ ] | 17 | Billing Settings Page | | | | 45 | |
| [ ] | 18 | Balance Check Utility | | | | 45 | |
| [ ] | 19 | Balance Check Hook | | | | 30 | |
| [ ] | 20 | Auto-Refill Database & API | | | | 45 | |
| [ ] | 21 | Auto-Refill Settings Component | | | | 45 | |

**Summary:**
- Total tasks: 21
- Completed: 0
- Total time spent: 0 minutes
- Total human estimate: 885 minutes (~14.75 hours)
- Overall multiplier: TBD
