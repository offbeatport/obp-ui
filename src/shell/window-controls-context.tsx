"use client";

import { type ReactNode, createContext, useContext } from "react";

export type WindowPlatform = "macos" | "windows" | "linux";

export type WindowControlsApi = {
    platform: WindowPlatform;
    isMaximized: boolean;
    minimize: () => void;
    toggleMaximize: () => void;
    close: () => void;
};

const WindowControlsContext = createContext<WindowControlsApi | null>(null);

export function WindowControlsProvider({
    value,
    children,
}: {
    value: WindowControlsApi;
    children: ReactNode;
}) {
    return (
        <WindowControlsContext.Provider value={value}>{children}</WindowControlsContext.Provider>
    );
}

export function useWindowControls(): WindowControlsApi | null {
    return useContext(WindowControlsContext);
}
