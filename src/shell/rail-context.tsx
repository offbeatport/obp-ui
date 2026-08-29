"use client";

import { type ReactNode, createContext, useContext } from "react";

export type RailState = {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    toggle: () => void;
};

const DEFAULT_RAIL: RailState = {
    collapsed: false,
    setCollapsed: () => {},
    toggle: () => {},
};

const RailContext = createContext<RailState>(DEFAULT_RAIL);

export function RailProvider({ value, children }: { value: RailState; children: ReactNode }) {
    return <RailContext.Provider value={value}>{children}</RailContext.Provider>;
}

export function useRail(): RailState {
    return useContext(RailContext);
}

export function useRailCollapsed(): boolean {
    return useContext(RailContext).collapsed;
}
