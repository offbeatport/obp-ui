import { initTheme } from "@paperkit/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./app.css";

// One call at boot: applies the stored preference and follows the OS while in "system".
initTheme();

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
