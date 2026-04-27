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
      .then((registration) => {
        // Service Worker registrado exitosamente
        console.log('SW registrado:', registration.scope);
      })
      .catch((error) => {
        // Error en registro del SW
        console.log('Error SW:', error);
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
