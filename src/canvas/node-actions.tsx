"use client";

import { type ReactNode, createContext, useContext } from "react";

// React Flow only hands a node renderer its `data`, so the callbacks a card needs
// (open this entity, promote it, retry it …) cannot arrive as props - they ride a
// context instead. The bag is app-shaped and the package never inspects it: a
// renderer reads the callbacks it cares about and passes them DOWN as props to the
// presentational card, which keeps every hook above any conditional return.

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

/**
 * The action bag for the board currently being rendered. Call it UNCONDITIONALLY at
 * the top of a node renderer - React Flow mounts one renderer per node type, so a
 * hook placed after a `data.kind` guard is a latent hook-order bug.
 */
export function useNodeActions<A extends object>(): Partial<A> {
    return useContext(NodeActionsContext) as Partial<A>;
}
