import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, HashRouter } from "react-router-dom";
import { initSentry } from './sentry.js';
import { inject } from '@vercel/analytics';
import "./index.css";
import "./browser-compat.css"; // Compatibilidad con navegadores antiguos

// Initialize monitoring in production
if (import.meta.env.PROD) {
  initSentry();
  inject();
}

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
