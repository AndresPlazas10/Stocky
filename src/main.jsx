import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./browser-compat.css"; // Compatibilidad con navegadores antiguos
import "./no-animations.css"; // ZERO ANIMATIONS - Performance First

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
