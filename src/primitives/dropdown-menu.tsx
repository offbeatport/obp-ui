"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { useRender } from "@base-ui/react/use-render";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import * as React from "react";

import {
    type StringClassName,
    asChildProps,
    asChildRender,
    asChildVoid,
    autoFocusFor,
    childrenOf,
    collisionAvoidanceFor,
    slotChild,
    slotContent,
    stickyFor,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

type PartProps<T extends React.ElementType> = StringClassName<React.ComponentProps<T>>;

type ComposableProps<T extends React.ElementType> = PartProps<T> & {
    asChild?: boolean;
};

type DropdownMenuPositionerProps = Pick<
    React.ComponentProps<typeof MenuPrimitive.Positioner>,
    | "align"
    | "alignOffset"
    | "anchor"
    | "arrowPadding"
    | "collisionAvoidance"
    | "collisionBoundary"
    | "collisionPadding"
    | "disableAnchorTracking"
    | "positionMethod"
    | "side"
    | "sideOffset"
>;

type DropdownMenuContentCompatProps = {
    avoidCollisions?: boolean;
    forceMount?: boolean;
    loop?: boolean;
    onCloseAutoFocus?: (event: Event) => void;
    sticky?: boolean | "partial" | "always";
};

type ItemSelectHandler = (event: Event) => void;

type MenuItemClickHandler = NonNullable<React.ComponentProps<typeof MenuPrimitive.Item>["onClick"]>;

type ItemProps<T extends React.ElementType> = Omit<ComposableProps<T>, "onSelect"> & {
    onSelect?: ItemSelectHandler;
    textValue?: string;
};

function itemClickHandler(
    onClick: MenuItemClickHandler | undefined,
    onSelect: ItemSelectHandler | undefined,
    keepOpenOnPreventDefault: boolean,
): MenuItemClickHandler | undefined {
    if (!onClick && !onSelect) {
        return undefined;
    }
    return (event) => {
        onClick?.(event);
        if (!onSelect) {
            return;
        }
        onSelect(event.nativeEvent);
        if (keepOpenOnPreventDefault && event.nativeEvent.defaultPrevented) {
            event.preventBaseUIHandler();
        }
    };
}

const DropdownMenuGroupContext = React.createContext(false);

const DropdownMenuLoopContext = React.createContext<
    React.Dispatch<React.SetStateAction<boolean | undefined>> | undefined
>(undefined);

function useLiftedLoopFocus(loop: boolean | undefined) {
    const lift = React.useContext(DropdownMenuLoopContext);
    React.useEffect(() => {
        if (!lift) {
            return;
        }
        lift(loop);
        return () => lift(undefined);
    }, [lift, loop]);
}

const POPUP_TRANSITION =
    "transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none";

const POSITIONER_CLASS = "z-50 outline-hidden";

function DropdownMenu({
    dir,
    ...props
}: React.ComponentProps<typeof MenuPrimitive.Root> & { dir?: "ltr" | "rtl" }) {
    const [loopFocus, setLoopFocus] = React.useState<boolean | undefined>(undefined);
    const root = (
        <DropdownMenuLoopContext.Provider value={setLoopFocus}>
            <MenuPrimitive.Root data-slot="dropdown-menu" loopFocus={loopFocus} {...props} />
        </DropdownMenuLoopContext.Provider>
    );
    return dir ? <DirectionProvider direction={dir}>{root}</DirectionProvider> : root;
}

function DropdownMenuPortal({
    forceMount,
    keepMounted,
    asChild,
    children,
    ...props
}: ComposableProps<typeof MenuPrimitive.Portal> & { forceMount?: boolean }) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <MenuPrimitive.Portal
            data-slot="dropdown-menu-portal"
            keepMounted={keepMounted ?? forceMount}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DropdownMenuTrigger({
    asChild,
    children,
    ...props
}: ComposableProps<typeof MenuPrimitive.Trigger>) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <MenuPrimitive.Trigger
            data-slot="dropdown-menu-trigger"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DropdownMenuContent({
    className,
    sideOffset = 4,
    align,
    alignOffset,
    anchor,
    arrowPadding,
    avoidCollisions,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    disableAnchorTracking,
    forceMount,
    loop,
    onCloseAutoFocus,
    positionMethod,
    side,
    sticky,
    asChild,
    children,
    ...props
}: ComposableProps<typeof MenuPrimitive.Popup> &
    DropdownMenuPositionerProps &
    DropdownMenuContentCompatProps) {
    useLiftedLoopFocus(loop);
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <MenuPrimitive.Portal keepMounted={forceMount}>
            <MenuPrimitive.Positioner
                data-slot="dropdown-menu-positioner"
                className={POSITIONER_CLASS}
                align={align}
                alignOffset={alignOffset}
                anchor={anchor}
                arrowPadding={arrowPadding}
                collisionAvoidance={collisionAvoidanceFor(avoidCollisions, collisionAvoidance)}
                collisionBoundary={collisionBoundary}
                collisionPadding={collisionPadding}
                disableAnchorTracking={disableAnchorTracking}
                positionMethod={positionMethod}
                side={side}
                sideOffset={sideOffset}
                sticky={stickyFor(sticky)}
            >
                <MenuPrimitive.Popup
                    data-slot="dropdown-menu-content"
                    className={cn(
                        "max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-e2 outline-hidden",
                        POPUP_TRANSITION,
                        className,
                    )}
                    finalFocus={autoFocusFor(onCloseAutoFocus, "focusScope.autoFocusOnUnmount")}
                    {...props}
                    {...asChildProps(asChild, children)}
                />
            </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
    );
}

function DropdownMenuGroup({
    asChild,
    children,
    ...props
}: ComposableProps<typeof MenuPrimitive.Group>) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <DropdownMenuGroupContext.Provider value={true}>
            <MenuPrimitive.Group
                data-slot="dropdown-menu-group"
                {...props}
                {...asChildProps(asChild, children)}
            />
        </DropdownMenuGroupContext.Provider>
    );
}

function DropdownMenuItem({
    className,
    inset,
    variant = "default",
    asChild,
    children,
    onClick,
    onSelect,
    textValue,
    ...props
}: ItemProps<typeof MenuPrimitive.Item> & {
    inset?: boolean;
    variant?: "default" | "destructive";
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <MenuPrimitive.Item
            data-slot="dropdown-menu-item"
            data-inset={inset || undefined}
            data-variant={variant}
            label={textValue}
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
                className,
            )}
            onClick={itemClickHandler(onClick, onSelect, true)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DropdownMenuCheckboxItem({
    className,
    children,
    checked,
    closeOnClick = true,
    asChild,
    onClick,
    onSelect,
    render,
    textValue,
    ...props
}: ItemProps<typeof MenuPrimitive.CheckboxItem>) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <MenuPrimitive.CheckboxItemIndicator>
                    <CheckIcon className="size-4" />
                </MenuPrimitive.CheckboxItemIndicator>
            </span>
            {inner}
        </>
    );
    return (
        <MenuPrimitive.CheckboxItem
            data-slot="dropdown-menu-checkbox-item"
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            checked={checked}
            closeOnClick={closeOnClick}
            label={textValue}
            onClick={itemClickHandler(onClick, onSelect, false)}
            render={render}
            {...props}
            {...slotContent(child, content)}
        />
    );
}

function DropdownMenuRadioGroup({
    asChild,
    children,
    ...props
}: ComposableProps<typeof MenuPrimitive.RadioGroup>) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <DropdownMenuGroupContext.Provider value={true}>
            <MenuPrimitive.RadioGroup
                data-slot="dropdown-menu-radio-group"
                {...props}
                {...asChildProps(asChild, children)}
            />
        </DropdownMenuGroupContext.Provider>
    );
}

function DropdownMenuRadioItem({
    className,
    children,
    closeOnClick = true,
    asChild,
    onClick,
    onSelect,
    render,
    textValue,
    ...props
}: ItemProps<typeof MenuPrimitive.RadioItem>) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <MenuPrimitive.RadioItemIndicator>
                    <CircleIcon className="size-2 fill-current" />
                </MenuPrimitive.RadioItemIndicator>
            </span>
            {inner}
        </>
    );
    return (
        <MenuPrimitive.RadioItem
            data-slot="dropdown-menu-radio-item"
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            closeOnClick={closeOnClick}
            label={textValue}
            onClick={itemClickHandler(onClick, onSelect, false)}
            render={render}
            {...props}
            {...slotContent(child, content)}
        />
    );
}

const DROPDOWN_MENU_LABEL_CLASS = "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8";

type DropdownMenuLabelProps = ComposableProps<typeof MenuPrimitive.GroupLabel> & {
    inset?: boolean;
};

function DropdownMenuLabel(props: DropdownMenuLabelProps) {
    const insideGroup = React.useContext(DropdownMenuGroupContext);
    return insideGroup ? (
        <DropdownMenuGroupLabel {...props} />
    ) : (
        <DropdownMenuLooseLabel {...props} />
    );
}

function DropdownMenuGroupLabel({
    className,
    inset,
    asChild,
    children,
    ...props
}: DropdownMenuLabelProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <MenuPrimitive.GroupLabel
            data-slot="dropdown-menu-label"
            data-inset={inset || undefined}
            className={cn(DROPDOWN_MENU_LABEL_CLASS, className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DropdownMenuLooseLabel({
    className,
    inset,
    asChild,
    children,
    render,
    ...props
}: DropdownMenuLabelProps) {
    return useRender({
        enabled: !asChildVoid(asChild, children),
        defaultTagName: "div",
        render: asChildRender(asChild, children) ?? render,
        props: {
            role: "presentation",
            "data-slot": "dropdown-menu-label",
            "data-inset": inset || undefined,
            className: cn(DROPDOWN_MENU_LABEL_CLASS, className),
            ...props,
            ...(asChild ? {} : { children }),
        },
    });
}

function DropdownMenuSeparator({
    className,
    asChild,
    children,
    ...props
}: ComposableProps<typeof MenuPrimitive.Separator>) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <MenuPrimitive.Separator
            data-slot="dropdown-menu-separator"
            className={cn("-mx-1 my-1 h-px bg-border", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="dropdown-menu-shortcut"
            className={cn("ml-auto text-sm tracking-widest text-muted-foreground", className)}
            {...props}
        />
    );
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof MenuPrimitive.SubmenuRoot>) {
    const [loopFocus, setLoopFocus] = React.useState<boolean | undefined>(undefined);
    return (
        <DropdownMenuLoopContext.Provider value={setLoopFocus}>
            <MenuPrimitive.SubmenuRoot
                data-slot="dropdown-menu-sub"
                loopFocus={loopFocus}
                {...props}
            />
        </DropdownMenuLoopContext.Provider>
    );
}

function DropdownMenuSubTrigger({
    className,
    inset,
    asChild,
    children,
    render,
    textValue,
    ...props
}: ComposableProps<typeof MenuPrimitive.SubmenuTrigger> & {
    inset?: boolean;
    textValue?: string;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            {inner}
            <ChevronRightIcon className="ml-auto size-4" />
        </>
    );
    return (
        <MenuPrimitive.SubmenuTrigger
            data-slot="dropdown-menu-sub-trigger"
            data-inset={inset || undefined}
            label={textValue}
            className={cn(
                "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[inset]:pl-8 data-popup-open:bg-accent data-popup-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
                className,
            )}
            render={render}
            {...props}
            {...slotContent(child, content)}
        />
    );
}

function DropdownMenuSubContent({
    className,
    align,
    alignOffset,
    anchor,
    arrowPadding,
    avoidCollisions,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    disableAnchorTracking,
    forceMount,
    loop,
    onCloseAutoFocus,
    positionMethod,
    side,
    sideOffset,
    sticky,
    asChild,
    children,
    ...props
}: ComposableProps<typeof MenuPrimitive.Popup> &
    DropdownMenuPositionerProps &
    DropdownMenuContentCompatProps) {
    useLiftedLoopFocus(loop);
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <MenuPrimitive.Portal keepMounted={forceMount}>
            <MenuPrimitive.Positioner
                data-slot="dropdown-menu-sub-positioner"
                className={POSITIONER_CLASS}
                align={align}
                alignOffset={alignOffset}
                anchor={anchor}
                arrowPadding={arrowPadding}
                collisionAvoidance={collisionAvoidanceFor(avoidCollisions, collisionAvoidance)}
                collisionBoundary={collisionBoundary}
                collisionPadding={collisionPadding}
                disableAnchorTracking={disableAnchorTracking}
                positionMethod={positionMethod}
                side={side}
                sideOffset={sideOffset}
                sticky={stickyFor(sticky)}
            >
                <MenuPrimitive.Popup
                    data-slot="dropdown-menu-sub-content"
                    className={cn(
                        "min-w-[8rem] origin-(--transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-e2 outline-hidden",
                        POPUP_TRANSITION,
                        className,
                    )}
                    finalFocus={autoFocusFor(onCloseAutoFocus, "focusScope.autoFocusOnUnmount")}
                    {...props}
                    {...asChildProps(asChild, children)}
                />
            </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
    );
}

export {
    DropdownMenu,
    DropdownMenuPortal,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
};
