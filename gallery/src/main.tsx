import { initTheme, initThemePreset } from "obp-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./app.css";

initTheme();
initThemePreset();

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
