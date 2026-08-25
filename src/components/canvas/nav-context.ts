import { createContext, useContext } from "react";

// Navigation callbacks the board nodes need (open a company / start a new one). React Flow only
// passes `data` to nodes, so callbacks ride a context. Company clicks are handled by the canvas's
// onNodeClick; this context is for the opportunity "promote" button.
export type CanvasNav = { onNewCompany?: () => void };

export const CanvasNavContext = createContext<CanvasNav>({});
export const useCanvasNav = () => useContext(CanvasNavContext);
