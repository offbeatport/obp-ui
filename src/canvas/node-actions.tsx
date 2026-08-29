"use client";

import { type ReactNode, createContext, useContext } from "react";

const NodeActionsContext = createContext<Record<string, unknown>>({});

export type NodeActionsProviderProps<A extends object> = {
    actions: A;
    children: ReactNode;
};

export function NodeActionsProvider<A extends object>({
    actions,
    children,
}: NodeActionsProviderProps<A>) {
    return (
        <NodeActionsContext.Provider value={actions as Record<string, unknown>}>
            {children}
        </NodeActionsContext.Provider>
    );
}

export function useNodeActions<A extends object>(): Partial<A> {
    return useContext(NodeActionsContext) as Partial<A>;
}
