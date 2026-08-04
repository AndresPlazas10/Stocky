import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, HashRouter } from "react-router-dom";
import { initSentry } from './sentry.js';
import { inject } from '@vercel/analytics';
import { logger } from './utils/logger';
import * as Sentry from '@sentry/react';
import "./i18n";
import "./index.css";
import "./browser-compat.css"; // Compatibilidad con navegadores antiguos

// Initialize monitoring in production
if (import.meta.env.PROD) {
  initSentry();
  inject();
}

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  logger.error('[global] unhandled_promise_rejection', {
    message: String(event.reason?.message || event.reason || 'Unknown rejection'),
    stack: String(event.reason?.stack || ''),
  });
  if (event.reason instanceof Error) {
    Sentry.captureException(event.reason);
  } else {
    Sentry.captureMessage(String(event.reason || 'Unhandled rejection'), { level: 'error' });
  }
  event.preventDefault();
});

const isFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
const Router = isFileProtocol ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <Router>
        <App />
      </Router>
    </ErrorBoundary>
  </StrictMode>,
);
