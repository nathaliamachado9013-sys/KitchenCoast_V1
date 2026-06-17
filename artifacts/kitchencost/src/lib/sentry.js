import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export const initSentry = () => {
  const environment = import.meta.env.MODE;
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: dsn,
    environment: environment,
    integrations: [
      new BrowserTracing({
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          window.history
        ),
      }),
    ],
    // Capture 10% of all transactions
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    release: import.meta.env.VITE_APP_VERSION,
    maxBreadcrumbs: 50,
    attachStacktrace: true,
  });
};

// Helper para capturar exceções
export const captureException = (error, context = {}) => {
  Sentry.withScope((scope) => {
    Object.keys(context).forEach((key) => {
      scope.setContext(key, context[key]);
    });
    Sentry.captureException(error);
  });
};

// Helper para capturar mensagens
export const captureMessage = (message, level = 'info') => {
  Sentry.captureMessage(message, level);
};

// Helper para adicionar tags
export const setUserContext = (user) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    restaurantId: user.restaurantId,
  });
};

// Helper para breadcrumbs (rastreamento de ações)
export const addBreadcrumb = (message, category = 'user-action', level = 'info') => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
};

export default Sentry;
