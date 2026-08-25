"use client";

// The rail's collapse state, published on context.
//
// AppShell owns the state, but the things that need it - nav items, section labels, entity
// rows, the account button - sit an arbitrary number of levels down inside a `rail` slot the
// HOST composes. Threading `collapsed` through every one of those layers would put a prop on
// the public API of components that otherwise take none, so it travels on context instead.
//
// Every consumer still accepts an explicit `collapsed` prop that wins over the context, so a
// component can be driven directly (a gallery, a story, a rail rendered outside an AppShell).

import { type ReactNode, createContext, useContext } from "react";

export type RailState = {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    toggle: () => void;
};

// No provider mounted → the rail reads as expanded and the toggles are inert. That is the
// right degradation for a static render, and it means no hook in this family can throw.
const DEFAULT_RAIL: RailState = {
    collapsed: false,
    setCollapsed: () => {},
    toggle: () => {},
};

const RailContext = createContext<RailState>(DEFAULT_RAIL);

export function RailProvider({ value, children }: { value: RailState; children: ReactNode }) {
    return <RailContext.Provider value={value}>{children}</RailContext.Provider>;
}

/** The whole rail state (collapsed + the two setters). Never throws. */
export function useRail(): RailState {
    return useContext(RailContext);
}

/** Shorthand for the one field most shell components need. */
export function useRailCollapsed(): boolean {
    return useContext(RailContext).collapsed;
}
