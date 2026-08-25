"use client";

// The native-window seam.
//
// A desktop shell has to minimise, maximise and close its window - all of which are native
// calls (@tauri-apps/api/window, Electron's ipcRenderer, …). The design system must never
// import any of those: it would break every web build and pin the kit to one runtime.
//
// So the host fills this context in - typically once, at the root of the desktop app:
//
//     const win = getCurrentWindow();
//     <WindowControlsProvider
//         value={{
//             platform: "windows",
//             isMaximized,
//             minimize: () => void win.minimize(),
//             toggleMaximize: () => void win.toggleMaximize(),
//             close: () => void win.close(),
//         }}
//     >
//
// With no provider the value is null and <WindowControls> renders nothing, which is exactly
// what a browser tab wants.

import { type ReactNode, createContext, useContext } from "react";

/** Matches @tauri-apps/plugin-os `platform()` for the three desktop targets. */
export type WindowPlatform = "macos" | "windows" | "linux";

export type WindowControlsApi = {
    platform: WindowPlatform;
    /** Drives the maximise/restore glyph. */
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

/** null on the web (no provider) - callers must handle that. */
export function useWindowControls(): WindowControlsApi | null {
    return useContext(WindowControlsContext);
}
