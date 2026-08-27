import { initPalette, initTheme } from "obp-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./app.css";

// Two calls at boot, in this order: the theme resolves light/dark, then the palette writes the
// token overrides for whichever mode won. Both run before render, so nothing paints untinted.
initTheme();
initPalette();

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
