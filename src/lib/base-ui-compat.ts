import type { Popover } from "@base-ui/react/popover";
import {
    type ComponentProps,
    Fragment,
    type ReactElement,
    type ReactNode,
    cloneElement,
    isValidElement,
} from "react";

function isSlottable(child: unknown): child is ReactElement {
    return isValidElement(child) && child.type !== Fragment;
}

export function asChildProps(
    asChild: boolean | undefined,
    children: ReactNode,
): { render: ReactElement } | { children: ReactNode } {
    const render = asChildRender(asChild, children);
    return render ? { render } : { children };
}

export function asChildRender(
    asChild: boolean | undefined,
    children: ReactNode,
): ReactElement | undefined {
    return asChild && isSlottable(children) ? children : undefined;
}

export function asChildVoid(asChild: boolean | undefined, children: ReactNode): boolean {
    return Boolean(asChild) && !isSlottable(children);
}

export type StringClassName<P> = Omit<P, "className"> & { className?: string };

export function childrenOf(child: ReactElement): ReactNode {
    return (child.props as { children?: ReactNode }).children;
}

export function slotContent(
    child: ReactElement | undefined,
    content: ReactNode,
): { render: ReactElement } | { children: ReactNode } {
    return child ? { render: cloneElement(child, undefined, content) } : { children: content };
}

export function slotChild(
    asChild: boolean | undefined,
    children: ReactNode,
    render?: unknown,
): { child: ReactElement | undefined; inner: ReactNode } {
    const child = asChildRender(asChild, children) ?? (isSlottable(render) ? render : undefined);
    const inner = (child ? childrenOf(child) : undefined) ?? (asChild ? undefined : children);
    return { child, inner };
}

export function inferNativeButton(
    child: ReactNode | ((...args: never[]) => unknown),
): boolean | undefined {
    if (typeof child === "function") return undefined;
    if (!isValidElement(child)) return undefined;
    return typeof child.type === "string" ? child.type === "button" : undefined;
}

type CollisionAvoidance = NonNullable<
    ComponentProps<typeof Popover.Positioner>["collisionAvoidance"]
>;

const NO_COLLISION_AVOIDANCE: CollisionAvoidance = {
    side: "none",
    align: "none",
    fallbackAxisSide: "none",
};

export function collisionAvoidanceFor(
    avoidCollisions: boolean | undefined,
    collisionAvoidance: CollisionAvoidance | undefined,
): CollisionAvoidance | undefined {
    if (collisionAvoidance) return collisionAvoidance;
    return avoidCollisions === false ? NO_COLLISION_AVOIDANCE : undefined;
}

export function stickyFor(sticky: boolean | "partial" | "always" | undefined): boolean | undefined {
    return typeof sticky === "string" ? sticky === "always" : sticky;
}

export function autoFocusFor(
    handler: ((event: Event) => void) | undefined,
    type: string,
): (() => boolean) | undefined {
    if (!handler) return undefined;
    return () => {
        const event = new Event(type, { cancelable: true });
        handler(event);
        return !event.defaultPrevented;
    };
}
