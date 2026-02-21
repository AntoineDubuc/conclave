// components/checkout/PromoCodeInput.tsx
'use client';

import { useState } from 'react';

interface PromoCodeResult {
  valid: boolean;
  promoCodeId?: string;
  percentOff?: number;
  amountOff?: number;
  duration?: string;
  durationMonths?: number;
  message?: string;
  error?: string;
}

interface PromoCodeInputProps {
  onApply: (codeText: string | null, promoCodeId: string | null, details: PromoCodeResult | null) => void;
}

export function PromoCodeInput({ onApply }: PromoCodeInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<PromoCodeResult | null>(null);

  const handleValidate = async () => {
    if (!code.trim()) return;

    setIsValidating(true);
    setResult(null);

    try {
      const response = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data: PromoCodeResult = await response.json();
      setResult(data);

      if (data.valid && data.promoCodeId) {
        onApply(code.trim(), data.promoCodeId, data);
      } else {
        onApply(null, null, null);
      }
    } catch {
      setResult({ valid: false, error: 'Failed to validate code' });
      onApply(null, null, null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    setCode('');
    setResult(null);
    onApply(null, null, null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleValidate();
    }
  };

  // Collapsed state - just show link
  if (!isExpanded && !result?.valid) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
      >
        Have a promo code?
      </button>
    );
  }

  // Applied state - show success message
  if (result?.valid) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium text-green-800 dark:text-green-200">
              Code applied: {result.message}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-green-600 hover:text-green-500 dark:text-green-400"
          >
            Remove
          </button>
        </div>
        {result.percentOff === 100 && (
          <p className="mt-2 text-sm text-green-700 dark:text-green-300">
            $0/month for {result.durationMonths} month{result.durationMonths !== 1 ? 's' : ''}, then $10/month
          </p>
        )}
      </div>
    );
  }

  // Expanded input state
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Promo code
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="Enter code"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={isValidating}
        />
        <button
          type="button"
          onClick={handleValidate}
          disabled={!code.trim() || isValidating}
          className="rounded-md bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isValidating ? 'Checking...' : 'Apply'}
        </button>
      </div>

      {result?.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {result.error}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setIsExpanded(false);
          setCode('');
          setResult(null);
        }}
        className="mt-2 text-sm text-gray-500 hover:text-gray-600 dark:text-gray-400"
      >
        Cancel
      </button>
    </div>
  );
}
