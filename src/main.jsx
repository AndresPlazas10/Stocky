import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { BrowserRouter, HashRouter } from "react-router-dom";
import "./index.css";
import "./browser-compat.css"; // Compatibilidad con navegadores antiguos

const isFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
const Router = isFileProtocol ? HashRouter : BrowserRouter;

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator && !isFileProtocol) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => {
        // Service Worker registrado exitosamente
      })
      .catch(() => {
        // Error en registro del SW - silenciar
      });
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <Router>
        <App />
      </Router>
    </ErrorBoundary>
  </StrictMode>,
);
