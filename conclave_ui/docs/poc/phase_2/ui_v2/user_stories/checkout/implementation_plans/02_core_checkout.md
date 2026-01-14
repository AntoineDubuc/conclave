# Implementation Plan 2: Core Checkout

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
| `rounded-lg border p-6` | `glass-card` |
| `bg-white/5 backdrop-blur-sm` | `glass` or `glass-panel` |
| `bg-muted/50` | `glass-subtle` or `bg-white/5` |
| `bg-gray-800` | `bg-[var(--bg-elevated)]` |
| `text-muted-foreground` | `text-white/50` or CSS var `--text-muted` |
| `border border-gray-200` | `border border-white/10` |
| `bg-indigo-600` | `gradient-brand` |
| `text-3xl font-bold` | `text-h3` or appropriate typography class |
| `px-4 py-2 bg-primary` | `gradient-brand px-4 py-2 rounded-xl` |

### Mandatory Patterns for This Plan

**All Dialogs/Modals:**
```tsx
<DialogContent className="glass-card sm:max-w-[425px]">
```

**All Cards:**
```tsx
<div className="glass-card p-6">
  {/* or for selectable cards */}
</div>
<div className="glass-card-hover p-6 cursor-pointer">
```

**All Primary Buttons:**
```tsx
<Button className="gradient-brand text-white hover:shadow-purple-500/40">
```

**All Page Backgrounds:**
```tsx
<div className="min-h-screen bg-[var(--bg-base)]">
```

**All Fee/Info Boxes:**
```tsx
<div className="glass-subtle p-4 rounded-lg">
```

**All Error Messages:**
```tsx
<div className="glass p-3 rounded-lg border border-red-500/30 text-red-400">
```

---

## Overview

This plan implements the core checkout flows for Conclave, enabling users to purchase credits (Managed Plan) and subscribe to BYOK. It builds directly on the infrastructure established in Plan 1.

**Scope:**
- Flow 1: New User Signup to Checkout (Managed + BYOK paths)
- Flow 2: Existing User Adds Funds (Managed Plan)
- Flow 3: Existing User Subscribes to BYOK
- Payment Success page
- Payment Cancelled page
- Add Credits Modal component
- Stripe Checkout integration

**Does NOT include:**
- Plan switching flows (Plan 4: Subscription Lifecycle)
- Subscription cancellation/pause (Plan 4: Subscription Lifecycle)
- Gifting and referrals (Plan 6: BYOK and Social)
- API key setup for BYOK (Plan 6: BYOK and Social)
- Account deletion (Plan 4: Subscription Lifecycle)
- Low balance warnings and auto-refill (Plan 3: Billing Management)

---

## Prerequisites

| Requirement | From Plan | Status |
|-------------|-----------|--------|
| **DESIGN_SYSTEM.md read and understood** | - | **MANDATORY** |
| **DESIGN_TOKENS.md read and understood** | - | **MANDATORY** |
| Supabase schema deployed | Plan 1 | Must be complete |
| Stripe products created | Plan 1 | Must be complete |
| Webhook handler implemented | Plan 1 | Must be complete |
| Supabase client utilities | Plan 1 | Must be complete |
| Stripe client utilities | Plan 1 | Must be complete |
| Environment variables configured | Plan 1 | Must be complete |

> **⚠️ DESIGN SYSTEM CHECKPOINT:** Do NOT proceed until you can identify by memory:
> - The glass utility classes (`glass`, `glass-card`, `glass-panel`, `glass-elevated`)
> - The gradient utilities (`gradient-brand`, `gradient-brand-text`, `gradient-border`)
> - The typography classes (`text-h1`, `text-h2`, `text-h3`, `text-body-lg`)
> - The color variables (`--bg-base`, `--bg-elevated`, `--text-primary`, `--text-secondary`)

**Verify Plan 1 completion:**
```bash
# Run these checks before starting Plan 2
curl -X POST http://localhost:3000/api/webhooks/stripe
# Expected: 400 (missing signature) - confirms route exists

npm list stripe @supabase/supabase-js
# Expected: Both packages installed
```

---

## File Structure

After completing this plan, the following files will be created/modified:

```
conclave_ui/conclave-app/
├── app/
│   ├── checkout/
│   │   ├── success/
│   │   │   └── page.tsx              # Payment success page
│   │   ├── cancelled/
│   │   │   └── page.tsx              # Payment cancelled page
│   │   └── subscribe/
│   │       └── page.tsx              # BYOK subscription page
│   ├── onboarding/
│   │   └── plan/
│   │       └── page.tsx              # Fallback plan selection
│   └── api/
│       └── checkout/
│           ├── credits/
│           │   └── route.ts          # Create credits checkout session
│           └── subscribe/
│               └── route.ts          # Create subscription checkout session
├── components/
│   ├── modals/
│   │   └── AddCreditsModal.tsx       # Add credits modal component
│   └── checkout/
│       ├── PlanCard.tsx              # Plan selection card
│       ├── SuccessContent.tsx        # Success page content
│       └── ProcessingState.tsx       # Payment processing state
├── hooks/
│   └── useCheckout.ts                # Checkout-related hooks
└── lib/
    └── checkout/
        └── index.ts                  # Checkout utility functions
```

---

## Task Breakdown

### Task 1: API Route - Create Credits Checkout Session

Create the API endpoint that generates a Stripe Checkout session for credit purchases.

**File:** `conclave_ui/conclave-app/app/api/checkout/credits/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { stripe, getOrCreateCustomer } from '@/lib/stripe';

// Validation constants
const MIN_AMOUNT_CENTS = 1000;  // $10 minimum
const MAX_AMOUNT_CENTS = 100000; // $1,000 maximum

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { amount_cents } = body;

    if (!amount_cents || typeof amount_cents !== 'number') {
      return NextResponse.json(
        { error: 'Amount is required' },
        { status: 400 }
      );
    }

    if (amount_cents < MIN_AMOUNT_CENTS) {
      return NextResponse.json(
        { error: `Minimum amount is $${MIN_AMOUNT_CENTS / 100}` },
        { status: 400 }
      );
    }

    if (amount_cents > MAX_AMOUNT_CENTS) {
      return NextResponse.json(
        { error: `Maximum amount is $${MAX_AMOUNT_CENTS / 100}` },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(user.id, user.email!, supabase);

    // Calculate fees for display (informational only)
    const stripeFeePercent = 0.029;
    const stripeFeeFixed = 30; // cents
    const processingFee = Math.round(amount_cents * stripeFeePercent) + stripeFeeFixed;
    const totalCharge = amount_cents + processingFee;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: totalCharge,
            product: process.env.STRIPE_CREDITS_PRODUCT_ID!,
            product_data: {
              name: 'Conclave Credits',
              description: `$${(amount_cents / 100).toFixed(2)} in credits`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancelled`,
      metadata: {
        user_id: user.id,
        type: 'credits',
        credits_amount_cents: amount_cents.toString(),
        processing_fee_cents: processingFee.toString(),
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating credits checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

---

### Task 2: API Route - Create Subscription Checkout Session

Create the API endpoint for BYOK subscription checkout.

**File:** `conclave_ui/conclave-app/app/api/checkout/subscribe/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe, getOrCreateCustomer } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .single();

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(user.id, user.email!, supabase);

    // Create Stripe Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_BYOK_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancelled`,
      metadata: {
        user_id: user.id,
        type: 'byok_subscription',
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating subscription checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

---

### Task 3: Add Credits Modal Component

> **🎨 DESIGN SYSTEM REMINDER:** This modal MUST use:
> - `glass-card` for DialogContent
> - `glass-subtle` for info/fee breakdown boxes
> - `gradient-brand` for the primary CTA button
> - CSS variables for colors (`--text-primary`, `--text-secondary`)
> - `text-h4` or `text-h3` for the title

The reusable modal for adding credits, used across multiple entry points.

**File:** `conclave_ui/conclave-app/components/modals/AddCreditsModal.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Info } from 'lucide-react';

interface AddCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number; // in cents
  onSuccess?: () => void;
}

// Fee calculation constants
const STRIPE_FEE_PERCENT = 0.029;
const STRIPE_FEE_FIXED = 30; // cents
const MIN_AMOUNT = 10; // dollars
const MAX_AMOUNT = 1000; // dollars

export function AddCreditsModal({
  isOpen,
  onClose,
  currentBalance = 0,
  onSuccess,
}: AddCreditsModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState<string>('25');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate fees and totals
  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const processingFee = Math.round(amountCents * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED;
  const totalCharge = amountCents + processingFee;
  const newBalance = currentBalance + amountCents;

  // Validate amount
  const isValidAmount = amountCents >= MIN_AMOUNT * 100 && amountCents <= MAX_AMOUNT * 100;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string, numbers, and one decimal point
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!isValidAmount) {
      setError(`Please enter an amount between $${MIN_AMOUNT} and $${MAX_AMOUNT}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount_cents: amountCents,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('25');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // ⚠️ DESIGN SYSTEM: All styling below uses the glass-gradient design system
  // DO NOT replace with generic Tailwind classes
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* DESIGN SYSTEM: glass-card for modal background */}
      <DialogContent className="glass-card sm:max-w-[425px]">
        <DialogHeader>
          {/* DESIGN SYSTEM: text-h4 for modal titles */}
          <DialogTitle className="text-h4 text-white">Add Credits</DialogTitle>
          {currentBalance > 0 && (
            <DialogDescription className="text-white/50">
              Current balance: ${(currentBalance / 100).toFixed(2)}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Amount input */}
          <div className="grid gap-2">
            <Label htmlFor="amount" className="text-white/70">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                $
              </span>
              {/* DESIGN SYSTEM: glass-subtle for input background */}
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                className="pl-7 glass-subtle border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                placeholder="25.00"
                disabled={isLoading}
              />
            </div>
            <p className="text-xs text-white/50">
              Minimum ${MIN_AMOUNT} - Maximum ${MAX_AMOUNT}
            </p>
          </div>

          {/* Fee breakdown - DESIGN SYSTEM: glass-subtle for info boxes */}
          {amountCents > 0 && (
            <div className="glass-subtle rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm text-white">
                <span>Credits to account</span>
                <span>${(amountCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-white/50">
                <span>Processing fee (2.9% + $0.30)</span>
                <span>${(processingFee / 100).toFixed(2)}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between font-medium text-white">
                <span>Total charge</span>
                <span>${(totalCharge / 100).toFixed(2)}</span>
              </div>
              {currentBalance > 0 && (
                <div className="flex justify-between text-sm text-white/50 pt-1">
                  <span>New balance</span>
                  <span>${(newBalance / 100).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Tip - DESIGN SYSTEM: glass-subtle with appropriate icon color */}
          <div className="flex gap-2 text-xs text-white/50 glass-subtle rounded-lg p-3">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-purple-400" />
            <span>Adding more at once means lower fees per dollar.</span>
          </div>

          {/* Error message - DESIGN SYSTEM: glass with error border */}
          {error && (
            <div className="text-sm text-red-400 glass rounded-lg p-3 border border-red-500/30">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {/* DESIGN SYSTEM: ghost button style for secondary actions */}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="border-white/20 text-white/80 hover:border-white/40 hover:text-white"
          >
            Cancel
          </Button>
          {/* DESIGN SYSTEM: gradient-brand for primary CTA */}
          <Button
            onClick={handleSubmit}
            disabled={!isValidAmount || isLoading}
            className="gradient-brand text-white hover:shadow-purple-500/40"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Task 4: Plan Selection Card Component

> **🎨 DESIGN SYSTEM REMINDER:** Plan cards MUST use:
> - `glass-card` base with `glass-card-hover` for interactivity
> - `gradient-border` for selected/popular states
> - `gradient-brand` badge for "MOST POPULAR"
> - `text-h3` for plan names, proper text color classes
> - Purple accent colors from the design system

Reusable card for displaying plan options.

**File:** `conclave_ui/conclave-app/components/checkout/PlanCard.tsx`

```tsx
'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  name: string;
  price: string;
  priceDescription: string;
  features: string[];
  bestFor: string;
  isPopular?: boolean;
  isSelected?: boolean;
  buttonText: string;
  onSelect: () => void;
  disabled?: boolean;
}

export function PlanCard({
  name,
  price,
  priceDescription,
  features,
  bestFor,
  isPopular = false,
  isSelected = false,
  buttonText,
  onSelect,
  disabled = false,
}: PlanCardProps) {
  // ⚠️ DESIGN SYSTEM: Use glass-card with gradient-border for selection states
  return (
    <div
      className={cn(
        // DESIGN SYSTEM: glass-card-hover for interactive card
        'relative glass-card-hover p-6 transition-all cursor-pointer',
        // DESIGN SYSTEM: gradient-border for selected state
        isSelected && 'gradient-border',
        // DESIGN SYSTEM: purple ring for popular items
        isPopular && 'ring-2 ring-purple-500/50 ring-offset-2 ring-offset-[var(--bg-base)]'
      )}
      onClick={onSelect}
    >
      {/* DESIGN SYSTEM: gradient-brand badge for popular indicator */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="gradient-brand text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-purple-500/25">
            MOST POPULAR
          </span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          {/* DESIGN SYSTEM: text-h3 for card titles, text-white for primary text */}
          <h3 className="text-h3 text-white">{name}</h3>
          <div className="mt-2">
            {/* DESIGN SYSTEM: gradient-brand-text for price highlight */}
            <span className="text-3xl font-bold gradient-brand-text">{price}</span>
            <span className="text-white/50 ml-1">{priceDescription}</span>
          </div>
        </div>

        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-white/70">
              {/* DESIGN SYSTEM: purple accent for check icons */}
              <Check className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-white/50">
          <strong className="text-white/70">Best for:</strong> {bestFor}
        </p>

        {/* DESIGN SYSTEM: gradient-brand for selected, ghost style for unselected */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          disabled={disabled}
          className={cn(
            'w-full',
            isSelected
              ? 'gradient-brand text-white hover:shadow-purple-500/40'
              : 'border-white/20 text-white/80 hover:border-white/40 hover:text-white bg-transparent'
          )}
          variant={isSelected ? 'default' : 'outline'}
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
```

---

### Task 5: Plan Selection Page (Fallback)

> **🎨 DESIGN SYSTEM REMINDER:** This page MUST use:
> - `bg-[var(--bg-base)]` for page background
> - `text-h1` and `gradient-brand-text` for headline
> - `text-body-lg` and `text-white/70` for description
> - `gradient-brand` for primary CTA button
> - Decorative gradient blobs for visual interest

For users who navigate directly to `/signup` without a plan parameter.

**File:** `conclave_ui/conclave-app/app/onboarding/plan/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlanCard } from '@/components/checkout/PlanCard';
import { AddCreditsModal } from '@/components/modals/AddCreditsModal';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const PLANS = {
  managed: {
    name: 'Managed',
    price: 'From 30%',
    priceDescription: 'markup on API costs',
    features: [
      'No setup required',
      'We manage API keys',
      'Volume discounts down to 1%',
      'Start with just $10',
    ],
    bestFor: 'Trying out or light usage',
    buttonText: 'Select Managed',
  },
  byok: {
    name: 'BYOK',
    price: '$10',
    priceDescription: '/month',
    features: [
      '0% markup on API costs',
      'Use your own API keys',
      'Maximum control',
      'Cancel anytime',
    ],
    bestFor: 'Power users with existing API keys',
    buttonText: 'Select BYOK',
    isPopular: true,
  },
};

export default function PlanSelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<'managed' | 'byok' | null>(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlanSelect = (plan: 'managed' | 'byok') => {
    setSelectedPlan(plan);
  };

  const handleContinue = async () => {
    if (!selectedPlan) return;

    if (selectedPlan === 'managed') {
      setShowCreditsModal(true);
    } else {
      router.push('/checkout/subscribe');
    }
  };

  // ⚠️ DESIGN SYSTEM: All styling below uses the glass-gradient design system
  return (
    <div className="min-h-screen bg-[var(--bg-base)] relative overflow-hidden">
      {/* DESIGN SYSTEM: Decorative gradient blobs for visual interest */}
      <div className="fixed top-0 right-0 w-96 h-96 gradient-blob-purple pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 gradient-blob-cyan pointer-events-none" />

      <div className="container-app relative z-10 py-12 px-4">
        {/* DESIGN SYSTEM: text-h1 for page title, gradient-brand-text for emphasis */}
        <div className="text-center mb-12">
          <h1 className="text-h1 text-white">
            Choose Your <span className="gradient-brand-text">Plan</span>
          </h1>
          <p className="mt-4 text-body-lg text-white/70 max-w-2xl mx-auto">
            Welcome to Conclave! Choose how you would like to get started.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8 max-w-4xl mx-auto">
          <PlanCard
            {...PLANS.managed}
            isSelected={selectedPlan === 'managed'}
            onSelect={() => handlePlanSelect('managed')}
          />
          <PlanCard
            {...PLANS.byok}
            isSelected={selectedPlan === 'byok'}
            onSelect={() => handlePlanSelect('byok')}
          />
        </div>

        {/* DESIGN SYSTEM: gradient-brand for primary CTA */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={!selectedPlan || isLoading}
            className="gradient-brand text-white px-8 py-3 rounded-xl hover:shadow-purple-500/40 hover:scale-[1.02] transition-all"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="text-center mt-8">
          <Button
            variant="link"
            onClick={() => router.push('/pricing')}
            className="text-white/50 hover:text-white"
          >
            Compare plans in detail
          </Button>
        </div>
      </div>

      <AddCreditsModal
        isOpen={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />
    </div>
  );
}
```

---

### Task 6: BYOK Subscription Page

> **🎨 DESIGN SYSTEM REMINDER:** This page MUST use:
> - `bg-[var(--bg-base)]` for page background
> - `glass-card` for info panels and option boxes
> - `gradient-brand` for primary subscribe button
> - `text-h1` for page title, `gradient-brand-text` for price
> - Amber warning colors matching design system (amber-500/amber-400)
> - `glass-subtle` for option boxes inside warning panel

Full page for BYOK subscription with key requirement acknowledgment.

**File:** `conclave_ui/conclave-app/app/checkout/subscribe/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const API_KEY_OPTIONS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'One key for all models',
    recommended: true,
    link: 'https://openrouter.ai',
  },
  {
    id: 'direct',
    name: 'Direct Provider Keys',
    description: 'Manage keys for each provider separately',
    providers: [
      { name: 'Anthropic (Claude)', link: 'https://console.anthropic.com' },
      { name: 'OpenAI (GPT)', link: 'https://platform.openai.com' },
      { name: 'Google (Gemini)', link: 'https://aistudio.google.com' },
      { name: 'xAI (Grok)', link: 'https://console.x.ai' },
    ],
  },
];

export default function SubscribePage() {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!acknowledged) {
      setError('Please acknowledge that you have or will get API keys');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  // ⚠️ DESIGN SYSTEM: All styling below uses the glass-gradient design system
  return (
    <div className="min-h-screen bg-[var(--bg-base)] relative overflow-hidden">
      {/* DESIGN SYSTEM: Decorative gradient blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 gradient-blob-purple pointer-events-none" />

      <div className="container max-w-2xl mx-auto py-12 px-4 relative z-10">
        {/* Back button - DESIGN SYSTEM: ghost style */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-8 text-white/70 hover:text-white hover:bg-white/5"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Header - DESIGN SYSTEM: text-h1, gradient-brand-text for price */}
        <div className="mb-8">
          <h1 className="text-h1 text-white">BYOK Subscription</h1>
          <p className="mt-2 text-white/70">
            Use your own API keys. 0% markup. Cancel anytime.
          </p>
          <div className="mt-4">
            <span className="text-4xl font-bold gradient-brand-text">$10</span>
            <span className="text-white/50">/month</span>
          </div>
        </div>

        {/* API Key Requirements - DESIGN SYSTEM: glass-card with amber accent */}
        <div className="glass-card p-6 mb-8 border-amber-500/30">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-amber-300">
                  Before You Subscribe
                </h3>
                <p className="text-sm text-amber-200/70 mt-1">
                  You will need API keys from at least one provider:
                </p>
              </div>

              {/* OpenRouter option - DESIGN SYSTEM: glass-subtle */}
              <div className="glass-subtle rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">Option A: OpenRouter</h4>
                      {/* DESIGN SYSTEM: gradient-brand for recommended badge */}
                      <span className="text-xs gradient-brand text-white px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-sm text-white/50 mt-1">
                      One key for all models
                    </p>
                  </div>
                  <a
                    href="https://openrouter.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    Sign up
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Direct keys option - DESIGN SYSTEM: glass-subtle */}
              <div className="glass-subtle rounded-lg p-4">
                <h4 className="font-medium text-white">Option B: Direct Provider Keys</h4>
                <p className="text-sm text-white/50 mt-1 mb-3">
                  Enter API keys for each provider separately
                </p>
                <ul className="space-y-2">
                  {API_KEY_OPTIONS[1].providers?.map((provider) => (
                    <li
                      key={provider.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-white/70">{provider.name}</span>
                      <a
                        href={provider.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        Get key
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Acknowledgment checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(checked) => {
                    setAcknowledged(checked === true);
                    setError(null);
                  }}
                  className="border-white/30 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                />
                <Label
                  htmlFor="acknowledge"
                  className="text-sm font-normal cursor-pointer text-white/70"
                >
                  I have or will get API keys for at least one model
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Error message - DESIGN SYSTEM: glass with error border */}
        {error && (
          <div className="text-sm text-red-400 glass rounded-lg p-4 mb-8 border border-red-500/30">
            {error}
          </div>
        )}

        {/* Subscribe button - DESIGN SYSTEM: gradient-brand */}
        <Button
          size="lg"
          className="w-full gradient-brand text-white hover:shadow-purple-500/40 hover:scale-[1.01] transition-all"
          onClick={handleSubscribe}
          disabled={!acknowledged || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Subscribe - $10/month'
          )}
        </Button>

        <p className="text-xs text-white/50 text-center mt-4">
          You will be redirected to Stripe for secure payment.
          Cancel anytime from your billing settings.
        </p>
      </div>
    </div>
  );
}
```

---

### Task 7: Payment Success Page

Displays after successful checkout with appropriate next steps.

**File:** `conclave_ui/conclave-app/app/checkout/success/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { SuccessContent } from '@/components/checkout/SuccessContent';
import { ProcessingState } from '@/components/checkout/ProcessingState';

interface PageProps {
  searchParams: { session_id?: string };
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const sessionId = searchParams.session_id;

  if (!sessionId) {
    redirect('/dashboard');
  }

  const supabase = createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // Retrieve the Stripe session
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error('Failed to retrieve Stripe session:', error);
    redirect('/dashboard?error=invalid_session');
  }

  // Verify session belongs to current user
  if (session.metadata?.user_id !== user.id) {
    redirect('/dashboard?error=invalid_session');
  }

  // Check if webhook has processed
  const { data: webhookRecord } = await supabase
    .from('processed_webhooks')
    .select('id, result')
    .eq('stripe_event_id', `checkout.session.completed_${sessionId}`)
    .single();

  // Determine checkout type and prepare data
  const checkoutType = session.metadata?.type || 'credits';
  const isSubscription = session.mode === 'subscription';

  // Get updated user data
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_type')
    .eq('id', user.id)
    .single();

  const { data: balance } = await supabase
    .from('balances')
    .select('amount_cents')
    .eq('user_id', user.id)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('current_period_end')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  // If webhook hasn't processed yet, show processing state
  if (!webhookRecord) {
    return (
      <ProcessingState
        sessionId={sessionId}
        checkoutType={checkoutType}
      />
    );
  }

  // Render success content
  return (
    <SuccessContent
      checkoutType={checkoutType}
      isSubscription={isSubscription}
      balance={balance?.amount_cents || 0}
      planType={profile?.plan_type || 'managed'}
      nextBillingDate={subscription?.current_period_end}
    />
  );
}
```

---

### Task 8: Success Content Component

> **🎨 DESIGN SYSTEM REMINDER:** This component MUST use:
> - `bg-[var(--bg-base)]` for page background
> - `glass-card` for the details card
> - `gradient-brand` for primary action button
> - Green success colors (green-500/green-400) for success icon
> - `text-h2` for title, proper text colors

**File:** `conclave_ui/conclave-app/components/checkout/SuccessContent.tsx`

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessContentProps {
  checkoutType: string;
  isSubscription: boolean;
  balance: number;
  planType: string;
  nextBillingDate?: string;
}

export function SuccessContent({
  checkoutType,
  isSubscription,
  balance,
  planType,
  nextBillingDate,
}: SuccessContentProps) {
  const router = useRouter();

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ⚠️ DESIGN SYSTEM: All styling below uses the glass-gradient design system
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* DESIGN SYSTEM: Decorative gradient blob */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 gradient-blob-purple pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10">
        {/* Success icon - DESIGN SYSTEM: green success with glow */}
        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
          <Check className="h-8 w-8 text-green-400" />
        </div>

        {/* Title - DESIGN SYSTEM: text-h2 */}
        <h1 className="text-h2 text-white mb-2">
          {isSubscription ? 'Welcome to Conclave!' : 'Payment Successful'}
        </h1>
        <p className="text-white/70 mb-8">
          {isSubscription
            ? 'Your BYOK subscription is now active.'
            : 'Your credits have been added to your account.'}
        </p>

        {/* Details card - DESIGN SYSTEM: glass-card */}
        <div className="glass-card p-6 mb-8 text-left">
          {planType === 'byok' ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/50">Plan</span>
                <span className="font-medium text-white">BYOK</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/50">Status</span>
                <span className="font-medium text-green-400">
                  Active
                </span>
              </div>
              {nextBillingDate && (
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Next billing</span>
                  <span className="font-medium text-white">{formatDate(nextBillingDate)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/50">Plan</span>
                <span className="font-medium text-white">Managed</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-white/50">Balance</span>
                <span className="font-medium gradient-brand-text">
                  ${(balance / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Current tier</span>
                <span className="font-medium text-white">Tier 1 (30% markup)</span>
              </div>
            </>
          )}
        </div>

        {/* Action buttons - DESIGN SYSTEM: gradient-brand for primary */}
        <div className="space-y-3">
          {planType === 'byok' ? (
            <>
              <Button
                size="lg"
                className="w-full gradient-brand text-white hover:shadow-purple-500/40"
                onClick={() => router.push('/onboarding/keys')}
              >
                <Key className="mr-2 h-4 w-4" />
                Set Up API Keys
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full border-white/20 text-white/80 hover:border-white/40 hover:text-white"
                onClick={() => router.push('/dashboard')}
              >
                I'll do this later
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="w-full gradient-brand text-white hover:shadow-purple-500/40"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Receipt note */}
        <p className="text-xs text-white/50 mt-6">
          A receipt has been sent to your email.
        </p>
      </div>
    </div>
  );
}
```

---

### Task 9: Processing State Component

> **🎨 DESIGN SYSTEM REMINDER:** This component MUST use:
> - `bg-[var(--bg-base)]` for page background
> - `glass` for the loading spinner container
> - `text-h2` for title, `text-white/70` for description
> - `gradient-brand` spinner or purple accent colors

Shows while waiting for webhook to process.

**File:** `conclave_ui/conclave-app/components/checkout/ProcessingState.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProcessingStateProps {
  sessionId: string;
  checkoutType: string;
}

const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL = 2000; // 2 seconds

export function ProcessingState({ sessionId, checkoutType }: ProcessingStateProps) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    const pollWebhookStatus = async () => {
      try {
        const response = await fetch(
          `/api/checkout/status?session_id=${sessionId}`
        );
        const data = await response.json();

        if (data.processed) {
          router.refresh();
          return;
        }

        if (attempts < MAX_POLL_ATTEMPTS) {
          setTimeout(() => {
            setAttempts((prev) => prev + 1);
          }, POLL_INTERVAL);
        } else {
          setShowContinue(true);
        }
      } catch (error) {
        console.error('Error polling webhook status:', error);
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setShowContinue(true);
        }
      }
    };

    pollWebhookStatus();
  }, [attempts, sessionId, router]);

  // ⚠️ DESIGN SYSTEM: All styling below uses the glass-gradient design system
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* DESIGN SYSTEM: Animated gradient blob */}
      <div className="fixed top-1/3 right-1/4 w-96 h-96 gradient-blob-purple gradient-pulse pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10">
        {/* Loading spinner - DESIGN SYSTEM: glass container with purple spinner */}
        <div className="mx-auto w-16 h-16 rounded-full glass flex items-center justify-center mb-6">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>

        {/* Title - DESIGN SYSTEM: text-h2 */}
        <h1 className="text-h2 text-white mb-2">Processing Payment</h1>
        <p className="text-white/70 mb-8">
          Your payment is being processed. This usually takes a few seconds.
          Please don't close this page.
        </p>

        {/* Show continue option after timeout */}
        {showContinue && (
          <div className="space-y-4">
            <p className="text-sm text-white/50">
              If this takes more than 30 seconds, your{' '}
              {checkoutType === 'byok_subscription' ? 'subscription' : 'credits'}{' '}
              will appear shortly. You can safely continue to the dashboard.
            </p>
            {/* DESIGN SYSTEM: gradient-brand for CTA */}
            <Button
              onClick={() => router.push('/dashboard')}
              className="gradient-brand text-white hover:shadow-purple-500/40"
            >
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Task 10: Checkout Status API Route

For polling webhook processing status.

**File:** `conclave_ui/conclave-app/app/api/checkout/status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Check if webhook has been processed
  // We look for any webhook event related to this session
  const { data: webhookRecord } = await supabase
    .from('processed_webhooks')
    .select('id, result')
    .or(`stripe_event_id.ilike.%${sessionId}%`)
    .limit(1)
    .single();

  return NextResponse.json({
    processed: !!webhookRecord,
    result: webhookRecord?.result,
  });
}
```

---

### Task 11: Payment Cancelled Page

> **🎨 DESIGN SYSTEM REMINDER:** This component MUST use:
> - `bg-[var(--bg-base)]` for page background
> - `glass` for the cancel icon container
> - `text-h2` for title, `text-white/70` for description
> - `gradient-brand` for primary "Try Again" button
> - `text-purple-400` for links

Handles when user cancels from Stripe Checkout.

**File:** `conclave_ui/conclave-app/app/checkout/cancelled/page.tsx`

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutCancelledPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get('return_to') || '/dashboard';
  const checkoutType = searchParams.get('type') || 'credits';

  // ⚠️ DESIGN SYSTEM: All styling below uses the glass-gradient design system
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* DESIGN SYSTEM: Decorative gradient blob */}
      <div className="fixed bottom-0 left-1/4 w-96 h-96 gradient-blob-cyan pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10">
        {/* Cancel icon - DESIGN SYSTEM: glass container */}
        <div className="mx-auto w-16 h-16 rounded-full glass flex items-center justify-center mb-6">
          <XCircle className="h-8 w-8 text-white/50" />
        </div>

        {/* Title - DESIGN SYSTEM: text-h2 */}
        <h1 className="text-h2 text-white mb-2">Payment Cancelled</h1>
        <p className="text-white/70 mb-8">
          {checkoutType === 'byok_subscription'
            ? 'Your subscription was not completed. No charges were made.'
            : 'Your credit purchase was not completed. No charges were made.'}
        </p>

        {/* Action buttons - DESIGN SYSTEM: gradient-brand for primary */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full gradient-brand text-white hover:shadow-purple-500/40"
            onClick={() => {
              if (checkoutType === 'byok_subscription') {
                router.push('/checkout/subscribe');
              } else {
                router.push('/dashboard');
              }
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          {/* DESIGN SYSTEM: ghost button for secondary action */}
          <Button
            variant="outline"
            size="lg"
            className="w-full border-white/20 text-white/80 hover:border-white/40 hover:text-white"
            onClick={() => router.push(returnTo)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        {/* Help text - DESIGN SYSTEM: purple accent for links */}
        <p className="text-sm text-white/50 mt-8">
          Having trouble? Contact us at{' '}
          <a
            href="mailto:support@conclave.ai"
            className="text-purple-400 hover:text-purple-300"
          >
            support@conclave.ai
          </a>
        </p>
      </div>
    </div>
  );
}
```

---

### Task 12: useCheckout Hook

Reusable hook for checkout operations.

**File:** `conclave_ui/conclave-app/hooks/useCheckout.ts`

```typescript
'use client';

import { useState, useCallback } from 'react';

interface CheckoutOptions {
  amount_cents?: number;
  type: 'credits' | 'subscription';
}

interface CheckoutResult {
  sessionId: string;
  url: string;
}

export function useCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckoutSession = useCallback(
    async (options: CheckoutOptions): Promise<CheckoutResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const endpoint =
          options.type === 'subscription'
            ? '/api/checkout/subscribe'
            : '/api/checkout/credits';

        const body =
          options.type === 'credits'
            ? { amount_cents: options.amount_cents }
            : {};

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create checkout session');
        }

        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const redirectToCheckout = useCallback(
    async (options: CheckoutOptions) => {
      const result = await createCheckoutSession(options);
      if (result?.url) {
        window.location.href = result.url;
      }
    },
    [createCheckoutSession]
  );

  return {
    isLoading,
    error,
    createCheckoutSession,
    redirectToCheckout,
    clearError: () => setError(null),
  };
}
```

---

### Task 13: Checkout Utility Functions

Shared utilities for checkout flows.

**File:** `conclave_ui/conclave-app/lib/checkout/index.ts`

```typescript
// Fee calculation constants
export const STRIPE_FEE_PERCENT = 0.029;
export const STRIPE_FEE_FIXED_CENTS = 30;
export const MIN_CREDITS_AMOUNT_CENTS = 1000; // $10
export const MAX_CREDITS_AMOUNT_CENTS = 100000; // $1,000
export const BYOK_MONTHLY_PRICE_CENTS = 1000; // $10

/**
 * Calculate processing fee for a given amount
 */
export function calculateProcessingFee(amountCents: number): number {
  return Math.round(amountCents * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED_CENTS;
}

/**
 * Calculate total charge including processing fee
 */
export function calculateTotalCharge(amountCents: number): number {
  return amountCents + calculateProcessingFee(amountCents);
}

/**
 * Format cents to display currency
 */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Validate credit amount
 */
export function validateCreditAmount(amountCents: number): {
  valid: boolean;
  error?: string;
} {
  if (!amountCents || amountCents < MIN_CREDITS_AMOUNT_CENTS) {
    return {
      valid: false,
      error: `Minimum amount is ${formatCurrency(MIN_CREDITS_AMOUNT_CENTS)}`,
    };
  }

  if (amountCents > MAX_CREDITS_AMOUNT_CENTS) {
    return {
      valid: false,
      error: `Maximum amount is ${formatCurrency(MAX_CREDITS_AMOUNT_CENTS)}`,
    };
  }

  return { valid: true };
}

/**
 * Get tier information based on monthly spend
 */
export function getTierInfo(monthlySpendCents: number): {
  tier: number;
  markup: number;
  name: string;
  nextTierSpend: number | null;
} {
  const tiers = [
    { min: 10000000, tier: 7, markup: 1, name: 'Enterprise' },
    { min: 1000000, tier: 6, markup: 5, name: 'Tier 6' },
    { min: 500000, tier: 5, markup: 10, name: 'Tier 5' },
    { min: 100000, tier: 4, markup: 15, name: 'Tier 4' },
    { min: 50000, tier: 3, markup: 20, name: 'Tier 3' },
    { min: 10000, tier: 2, markup: 25, name: 'Tier 2' },
    { min: 0, tier: 1, markup: 30, name: 'Tier 1' },
  ];

  for (let i = 0; i < tiers.length; i++) {
    if (monthlySpendCents >= tiers[i].min) {
      return {
        tier: tiers[i].tier,
        markup: tiers[i].markup,
        name: tiers[i].name,
        nextTierSpend: i > 0 ? tiers[i - 1].min : null,
      };
    }
  }

  return {
    tier: 1,
    markup: 30,
    name: 'Tier 1',
    nextTierSpend: 10000,
  };
}
```

---

### Task 14: Update Webhook Handler for Checkout Events

Extend the webhook handler from Plan 1 to properly handle checkout completion.

**File:** Update `conclave_ui/conclave-app/app/api/webhooks/stripe/route.ts`

Add these cases to the webhook handler:

```typescript
// Add to the existing switch statement in the webhook handler

case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.user_id;
  const checkoutType = session.metadata?.type;

  if (!userId) {
    console.error('No user_id in session metadata');
    break;
  }

  if (session.mode === 'payment' && checkoutType === 'credits') {
    // Credit purchase
    const creditsAmount = parseInt(session.metadata?.credits_amount_cents || '0', 10);

    if (creditsAmount > 0) {
      await supabase.rpc('update_balance', {
        p_user_id: userId,
        p_amount_cents: creditsAmount,
        p_type: 'credit',
        p_description: 'Added credits via checkout',
        p_stripe_payment_id: session.payment_intent as string,
      });

      console.log(`Added ${creditsAmount} cents to user ${userId}`);
    }
  } else if (session.mode === 'subscription') {
    // BYOK subscription
    const subscriptionId = session.subscription as string;

    // Fetch subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Update profile to BYOK
    await supabase
      .from('profiles')
      .update({ plan_type: 'byok', updated_at: new Date().toISOString() })
      .eq('id', userId);

    // Create subscription record
    await supabase.from('subscriptions').upsert({
      user_id: userId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: subscription.items.data[0]?.price.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    });

    console.log(`Activated BYOK subscription for user ${userId}`);
  }

  break;
}

case 'customer.subscription.created':
case 'customer.subscription.updated': {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    await supabase.from('subscriptions').upsert({
      user_id: profile.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0]?.price.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    });
  }

  break;
}

case 'customer.subscription.deleted': {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  // Find user and revert to managed
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    await supabase
      .from('profiles')
      .update({ plan_type: 'managed', updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    console.log(`Cancelled subscription for user ${profile.id}, reverted to managed`);
  }

  break;
}
```

---

## Integration Points

### Entry Points for Add Credits Modal

The `AddCreditsModal` should be triggered from these locations:

| Location | Trigger | Implementation |
|----------|---------|----------------|
| Dashboard | "Add Credits" button | Import and render modal |
| Billing Settings | "Add Credits" button | Import and render modal |
| Flow Runner | Insufficient balance | Import with balance check |
| Navigation Header | Balance widget click | Import and render modal |

Example integration in a page:

```tsx
'use client';

import { useState } from 'react';
import { AddCreditsModal } from '@/components/modals/AddCreditsModal';

export default function DashboardPage() {
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const currentBalance = 2500; // From user data

  return (
    <div>
      {/* Your dashboard content */}
      <button onClick={() => setShowCreditsModal(true)}>
        Add Credits
      </button>

      <AddCreditsModal
        isOpen={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
        currentBalance={currentBalance}
      />
    </div>
  );
}
```

### Route Protection

All checkout pages should verify authentication. Server components check auth and redirect if needed:

```tsx
// In any server component
const supabase = createServerClient();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  redirect('/login');
}
```

---

## Verification Checklist

After completing all tasks, verify each item works correctly:

### API Routes

| Check | Expected Result |
|-------|-----------------|
| `POST /api/checkout/credits` with valid amount | Returns `{ sessionId, url }` |
| `POST /api/checkout/credits` without auth | Returns 401 |
| `POST /api/checkout/credits` with amount < $10 | Returns 400 with error |
| `POST /api/checkout/credits` with amount > $1000 | Returns 400 with error |
| `POST /api/checkout/subscribe` | Returns `{ sessionId, url }` |
| `POST /api/checkout/subscribe` with existing subscription | Returns 400 |
| `GET /api/checkout/status?session_id=xxx` | Returns `{ processed: boolean }` |

### UI Components

| Check | Expected Result |
|-------|-----------------|
| Open AddCreditsModal | Modal displays with $25 default |
| Enter amount < $10 | Button disabled, validation shown |
| Enter valid amount | Fee breakdown updates correctly |
| Click Continue | Redirects to Stripe Checkout |
| Visit /checkout/subscribe | Page displays with checkbox |
| Check acknowledgment box | Subscribe button enables |
| Submit subscription | Redirects to Stripe Checkout |

### Stripe Integration

| Check | Expected Result |
|-------|-----------------|
| Complete credit purchase in Stripe | Redirects to success page |
| Cancel from Stripe Checkout | Redirects to cancelled page |
| Complete subscription in Stripe | Redirects to success with BYOK info |
| Webhook receives checkout.session.completed | Balance/subscription updated |

### Pages

| Check | Expected Result |
|-------|-----------------|
| Visit /checkout/success without session_id | Redirects to dashboard |
| Visit /checkout/success with invalid session | Redirects with error |
| Visit /checkout/success before webhook | Shows processing state |
| Visit /checkout/success after webhook | Shows success content |
| Visit /checkout/cancelled | Shows cancel message with options |
| Visit /onboarding/plan | Shows plan selection cards |

---

## Testing with Stripe CLI

```bash
# Start webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# In another terminal, test credit purchase flow
stripe trigger checkout.session.completed \
  --add checkout_session:mode=payment \
  --add checkout_session:metadata[user_id]=test-user-123 \
  --add checkout_session:metadata[type]=credits \
  --add checkout_session:metadata[credits_amount_cents]=2500

# Test subscription flow
stripe trigger checkout.session.completed \
  --add checkout_session:mode=subscription \
  --add checkout_session:metadata[user_id]=test-user-123 \
  --add checkout_session:metadata[type]=byok_subscription
```

---

## Deliverables

| Deliverable | Location |
|-------------|----------|
| Credits checkout API | `app/api/checkout/credits/route.ts` |
| Subscribe checkout API | `app/api/checkout/subscribe/route.ts` |
| Checkout status API | `app/api/checkout/status/route.ts` |
| AddCreditsModal | `components/modals/AddCreditsModal.tsx` |
| PlanCard component | `components/checkout/PlanCard.tsx` |
| SuccessContent component | `components/checkout/SuccessContent.tsx` |
| ProcessingState component | `components/checkout/ProcessingState.tsx` |
| Plan selection page | `app/onboarding/plan/page.tsx` |
| Subscribe page | `app/checkout/subscribe/page.tsx` |
| Success page | `app/checkout/success/page.tsx` |
| Cancelled page | `app/checkout/cancelled/page.tsx` |
| useCheckout hook | `hooks/useCheckout.ts` |
| Checkout utilities | `lib/checkout/index.ts` |
| Updated webhook handler | `app/api/webhooks/stripe/route.ts` |

---

## Next Steps

After Plan 2 is complete:
- **Plan 3: Billing Management** - Build the billing dashboard with balance display, transaction history, tier progress, and auto-refill
- **Plan 4: Subscription Lifecycle** - Implement plan switching, subscription cancellation/pause, delete account, and payment failure handling
- **Plan 5: Security Hardening** - Rate limiting, CSRF protection, fraud prevention, and audit logging
- **Plan 6: BYOK and Social** - API key encryption, OpenRouter OAuth, gifting, referrals, and chargeback handling

---

## Troubleshooting

### "Failed to create checkout session"

- Verify Stripe API keys are correctly set in environment
- Check that `STRIPE_CREDITS_PRODUCT_ID` and `STRIPE_BYOK_PRICE_ID` exist in Stripe
- Ensure user has a valid Stripe customer ID (created on first checkout)

### Credits not appearing after checkout

- Check webhook handler logs for errors
- Verify `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint
- Use Stripe CLI to test webhook locally
- Check `processed_webhooks` table for duplicate prevention

### Success page stuck on "Processing"

- Webhook may be failing - check server logs
- Verify Supabase connection with service role key
- Check `processed_webhooks` table for the session

### Modal not opening

- Verify parent component manages `isOpen` state
- Check for React hydration errors in console
- Ensure Dialog component is imported correctly

---

## ⛔ DESIGN SYSTEM VERIFICATION CHECKLIST

> **MANDATORY:** Before marking this plan as complete, verify EVERY item below.
> **Failure to follow the design system will result in costly UI rewrites.**

### Global Checks

| Requirement | Verification |
|-------------|--------------|
| Read DESIGN_SYSTEM.md | ☐ Completed before implementation |
| Read DESIGN_TOKENS.md | ☐ Completed before implementation |
| No generic Tailwind for styled elements | ☐ No `bg-gray-*`, `border-gray-*`, `text-gray-*` |
| Dark theme colors used | ☐ All backgrounds use CSS vars or `bg-[var(--bg-*)]` |

### Component-by-Component Checklist

**AddCreditsModal (Task 3)**
- ☐ DialogContent uses `glass-card`
- ☐ DialogTitle uses `text-h4 text-white`
- ☐ Input uses `glass-subtle border-white/10`
- ☐ Fee breakdown uses `glass-subtle rounded-lg`
- ☐ Tip box uses `glass-subtle`
- ☐ Error message uses `glass rounded-lg border border-red-500/30 text-red-400`
- ☐ Primary button uses `gradient-brand text-white`
- ☐ Secondary button uses `border-white/20 text-white/80`

**PlanCard (Task 4)**
- ☐ Card uses `glass-card-hover`
- ☐ Selected state uses `gradient-border`
- ☐ Popular badge uses `gradient-brand`
- ☐ Plan name uses `text-h3 text-white`
- ☐ Price uses `gradient-brand-text`
- ☐ Features use `text-white/70` with `text-purple-400` check icons
- ☐ Selected button uses `gradient-brand`

**Plan Selection Page (Task 5)**
- ☐ Background uses `bg-[var(--bg-base)]`
- ☐ Has decorative `gradient-blob-purple` and `gradient-blob-cyan`
- ☐ Headline uses `text-h1 text-white` with `gradient-brand-text` accent
- ☐ Description uses `text-body-lg text-white/70`
- ☐ Continue button uses `gradient-brand` with hover effects

**BYOK Subscribe Page (Task 6)**
- ☐ Background uses `bg-[var(--bg-base)]`
- ☐ Has decorative `gradient-blob-purple`
- ☐ Title uses `text-h1 text-white`
- ☐ Price uses `gradient-brand-text`
- ☐ Warning panel uses `glass-card` with amber accent
- ☐ Option boxes use `glass-subtle`
- ☐ Recommended badge uses `gradient-brand`
- ☐ Links use `text-purple-400`
- ☐ Subscribe button uses `gradient-brand`

**Success Content (Task 8)**
- ☐ Background uses `bg-[var(--bg-base)]`
- ☐ Has decorative `gradient-blob-purple`
- ☐ Success icon has `bg-green-500/20 border-green-500/30` with glow
- ☐ Title uses `text-h2 text-white`
- ☐ Details card uses `glass-card`
- ☐ Balance value uses `gradient-brand-text`
- ☐ Primary button uses `gradient-brand`

**Processing State (Task 9)**
- ☐ Background uses `bg-[var(--bg-base)]`
- ☐ Has animated `gradient-blob-purple gradient-pulse`
- ☐ Spinner container uses `glass`
- ☐ Spinner icon is `text-purple-400`
- ☐ Title uses `text-h2 text-white`
- ☐ CTA button uses `gradient-brand`

**Cancelled Page (Task 11)**
- ☐ Background uses `bg-[var(--bg-base)]`
- ☐ Has decorative `gradient-blob-cyan`
- ☐ Cancel icon container uses `glass`
- ☐ Title uses `text-h2 text-white`
- ☐ Try Again button uses `gradient-brand`
- ☐ Go Back button uses `border-white/20 text-white/80`
- ☐ Support link uses `text-purple-400`

### Forbidden Patterns

The following patterns are **NEVER** acceptable in UI components:

```tsx
// ❌ WRONG - Generic Tailwind backgrounds
className="bg-gray-800"
className="bg-background"
className="bg-muted"

// ✅ CORRECT - Design system backgrounds
className="bg-[var(--bg-base)]"
className="bg-[var(--bg-elevated)]"
className="glass"
className="glass-card"

// ❌ WRONG - Generic Tailwind text colors
className="text-muted-foreground"
className="text-gray-400"

// ✅ CORRECT - Design system text colors
className="text-white/70"
className="text-white/50"

// ❌ WRONG - Generic buttons
className="bg-primary"
className="bg-indigo-600"

// ✅ CORRECT - Design system buttons
className="gradient-brand"

// ❌ WRONG - Generic borders
className="border"
className="rounded-lg border p-6"

// ✅ CORRECT - Design system borders
className="border border-white/10"
className="glass-card"
```

---

**Sign-off Required:** This plan cannot be marked complete until a code reviewer has verified all design system requirements are met.
