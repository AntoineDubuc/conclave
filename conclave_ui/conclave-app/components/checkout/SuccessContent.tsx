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

  // DESIGN SYSTEM: All styling uses the glass-gradient design system
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
                I&apos;ll do this later
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
