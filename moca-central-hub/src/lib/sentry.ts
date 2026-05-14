import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: window.location.hostname.includes('dev--')
      ? 'staging'
      : window.location.hostname.includes('localhost')
        ? 'development'
        : 'production',
    // Tag to distinguish from satellite apps
    initialScope: {
      tags: {
        app_name: 'moca-hub',
      },
    },
    // Sample 100% of errors, 10% of transactions for performance
    tracesSampleRate: 0.1,
    // Don't send errors in local dev
    enabled: !window.location.hostname.includes('localhost'),
    // Ignore common non-actionable errors
    ignoreErrors: [
      'ResizeObserver loop',
      'Network request failed',
      'Load failed',
    ],
  });
}

// Helper to identify the logged-in user in Sentry
export function setSentryUser(user: { id: string; email: string; role: string } | null) {
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, username: user.role });
  } else {
    Sentry.setUser(null);
  }
}

// Helper for satellite apps to init with same DSN but different app_name
export function initSentrySatellite(appName: string) {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: window.location.hostname.includes('localhost') ? 'development' : 'production',
    initialScope: {
      tags: { app_name: appName },
    },
    tracesSampleRate: 0.1,
    enabled: !window.location.hostname.includes('localhost'),
    ignoreErrors: ['ResizeObserver loop', 'Network request failed', 'Load failed'],
  });
}

export { Sentry };
