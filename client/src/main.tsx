import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SettingsProvider } from "./context/SettingsContext";
import { FollowProvider } from "./context/FollowContext";
import { CausesProvider } from "./context/CausesContext";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <FollowProvider>
          <CausesProvider>
            <App />
          </CausesProvider>
        </FollowProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>
);
