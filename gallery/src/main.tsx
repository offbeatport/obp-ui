import { initTheme, initThemePreset } from "obp-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./app.css";

// Two calls at boot, in this order: initTheme() resolves the MODE (light/dark), then
// initThemePreset() writes the four-axis token overrides for whichever mode won - the colour
// half is mode-specific, so it cannot run first. Both run before render, so nothing paints
// untinted or at the wrong density.
initTheme();
initThemePreset();

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
