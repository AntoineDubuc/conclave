// components/billing/PromoStatusBanner.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PromoStatusBannerProps {
  trialEndDate: Date;
  hasPaymentMethod: boolean;
}

export function PromoStatusBanner({ trialEndDate, hasPaymentMethod }: PromoStatusBannerProps) {
  const now = new Date();
  const daysRemaining = Math.ceil(
    (trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Initialize dismissed state from localStorage (avoids useEffect + setState)
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const dismissedAt = localStorage.getItem('promo-banner-dismissed');
      if (!dismissedAt) return false;
      const dismissedDate = new Date(dismissedAt);
      const hoursSinceDismissal = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceDismissal < 24 && daysRemaining >= 7;
    } catch {
      return false;
    }
  });

  // Don't show if user has payment method
  if (hasPaymentMethod) {
    return null;
  }

  // Don't show if dismissed (and > 7 days remaining)
  if (isDismissed && daysRemaining >= 7) {
    return null;
  }

  // Determine urgency styling
  let bgColor, textColor, borderColor, iconColor;
  if (daysRemaining <= 3) {
    bgColor = 'bg-red-50 dark:bg-red-900/20';
    textColor = 'text-red-800 dark:text-red-200';
    borderColor = 'border-red-200 dark:border-red-800';
    iconColor = 'text-red-600 dark:text-red-400';
  } else if (daysRemaining <= 7) {
    bgColor = 'bg-amber-50 dark:bg-amber-900/20';
    textColor = 'text-amber-800 dark:text-amber-200';
    borderColor = 'border-amber-200 dark:border-amber-800';
    iconColor = 'text-amber-600 dark:text-amber-400';
  } else {
    bgColor = 'bg-indigo-50 dark:bg-indigo-900/20';
    textColor = 'text-indigo-800 dark:text-indigo-200';
    borderColor = 'border-indigo-200 dark:border-indigo-800';
    iconColor = 'text-indigo-600 dark:text-indigo-400';
  }

  const handleDismiss = () => {
    localStorage.setItem('promo-banner-dismissed', new Date().toISOString());
    setIsDismissed(true);
  };

  const formattedDate = trialEndDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-4 mb-6`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`${iconColor} mt-0.5`}>
            {daysRemaining <= 3 ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          {/* Content */}
          <div>
            <p className={`font-medium ${textColor}`}>
              {daysRemaining <= 0 ? (
                'Your free trial has ended'
              ) : daysRemaining === 1 ? (
                'Your free trial ends tomorrow'
              ) : (
                `Free trial: ${daysRemaining} days remaining (ends ${formattedDate})`
              )}
            </p>
            <p className={`text-sm mt-1 ${textColor} opacity-80`}>
              Add a payment method to continue using BYOK after your trial.
            </p>
            <Link
              href="/settings/billing"
              className={`inline-block mt-2 text-sm font-medium ${iconColor} hover:underline`}
            >
              Add payment method &rarr;
            </Link>
          </div>
        </div>

        {/* Dismiss button (only show if > 3 days remaining) */}
        {daysRemaining > 3 && (
          <button
            onClick={handleDismiss}
            className={`${textColor} opacity-60 hover:opacity-100`}
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
