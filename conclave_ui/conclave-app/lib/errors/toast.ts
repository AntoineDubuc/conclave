'use client';

import { toast } from 'sonner';
import { getErrorMessage } from './messages';

/**
 * Toast utility functions for displaying user-friendly notifications.
 * Integrates with our error message mappings for consistent UX.
 */

/**
 * Display an error toast with optional action button.
 * Automatically extracts user-friendly message from any error type.
 *
 * @param error - Any error type (Error, Response error, custom object)
 * @param options - Optional toast configuration
 */
export function showErrorToast(
  error: unknown,
  options?: {
    duration?: number;
    onAction?: () => void;
  }
) {
  const errorInfo = getErrorMessage(error);

  toast.error(errorInfo.title, {
    description: errorInfo.message,
    duration: options?.duration || 5000,
    action: errorInfo.action
      ? {
          label: errorInfo.action.label,
          onClick: () => {
            if (options?.onAction) {
              options.onAction();
            } else if (typeof window !== 'undefined') {
              window.location.href = errorInfo.action!.href;
            }
          },
        }
      : undefined,
  });
}

/**
 * Display a success toast.
 *
 * @param message - Success message to display
 * @param description - Optional description
 */
export function showSuccessToast(message: string, description?: string) {
  toast.success(message, {
    description,
    duration: 3000,
  });
}

/**
 * Display an info toast.
 *
 * @param message - Info message to display
 * @param description - Optional description
 */
export function showInfoToast(message: string, description?: string) {
  toast.info(message, {
    description,
    duration: 4000,
  });
}

/**
 * Display a warning toast.
 *
 * @param message - Warning message to display
 * @param description - Optional description
 */
export function showWarningToast(message: string, description?: string) {
  toast.warning(message, {
    description,
    duration: 4000,
  });
}

/**
 * Display a loading toast that can be updated.
 * Returns a toast ID that can be used to dismiss or update the toast.
 *
 * @param message - Loading message to display
 * @returns Toast ID for updating/dismissing
 */
export function showLoadingToast(message: string): string | number {
  return toast.loading(message);
}

/**
 * Update an existing toast (typically to show completion).
 *
 * @param id - Toast ID returned from showLoadingToast
 * @param message - New message
 * @param type - Toast type to transition to
 */
export function updateToast(
  id: string | number,
  message: string,
  type: 'success' | 'error' | 'info' = 'success'
) {
  toast.dismiss(id);

  switch (type) {
    case 'success':
      toast.success(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'info':
      toast.info(message);
      break;
  }
}

/**
 * Dismiss a specific toast or all toasts.
 *
 * @param id - Optional toast ID. If omitted, dismisses all toasts.
 */
export function dismissToast(id?: string | number) {
  if (id) {
    toast.dismiss(id);
  } else {
    toast.dismiss();
  }
}

/**
 * Show a toast for common flow-related actions.
 */
export const flowToasts = {
  executionStarted: () => {
    return showLoadingToast('Executing flow...');
  },

  executionSuccess: (cost?: number) => {
    const message = cost
      ? `Flow completed successfully! Cost: $${cost.toFixed(4)}`
      : 'Flow completed successfully!';
    showSuccessToast(message);
  },

  executionFailed: (error: unknown) => {
    showErrorToast(error);
  },

  insufficientBalance: (required: number, available: number) => {
    toast.error('Insufficient Balance', {
      description: `You need $${required.toFixed(2)} but have $${available.toFixed(2)}`,
      action: {
        label: 'Add Funds',
        onClick: () => {
          if (typeof window !== 'undefined') {
            window.location.href = '/checkout';
          }
        },
      },
      duration: 8000,
    });
  },
};

/**
 * Show a toast for API key related actions.
 */
export const apiKeyToasts = {
  saved: (provider: string) => {
    showSuccessToast(`${provider} API key saved`, 'Your key has been encrypted and stored securely.');
  },

  deleted: (provider: string) => {
    showSuccessToast(`${provider} API key deleted`);
  },

  invalid: (provider: string) => {
    toast.error('Invalid API Key', {
      description: `The ${provider} API key appears to be invalid.`,
      action: {
        label: 'Try Again',
        onClick: () => {
          // Focus on the input field if possible
        },
      },
    });
  },
};

/**
 * Show a toast for settings related actions.
 */
export const settingsToasts = {
  saved: () => {
    showSuccessToast('Settings saved');
  },

  failed: () => {
    showErrorToast({ code: 'VALIDATION_ERROR' });
  },
};
