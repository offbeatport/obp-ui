import {
    type HTMLAttributes,
    type MouseEvent,
    type ReactElement,
    type ReactNode,
    cloneElement,
    isValidElement,
} from "react";

import { cn } from "../lib/cn";

const BODY_LAYOUT = {
    toggle: "flex-row items-center",
    normal: "flex-col items-stretch @md/settings-row:flex-row @md/settings-row:items-center",
    wide: "flex-col items-stretch @xl/settings-row:flex-row @xl/settings-row:items-center",
};

const CONTROL_LAYOUT = {
    toggle: "flex-row-reverse",
    normal: "@md/settings-row:flex-row-reverse",
    wide: "w-full @xl/settings-row:w-80 @xl/settings-row:flex-row-reverse",
};

type SettingsRowProps = {
    id?: string;
    label: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
    control: ReactNode;
    toggle?: boolean;
    disabled?: boolean;
    wide?: boolean;
    className?: string;
    children?: ReactNode;
};

function describedControl(control: ReactNode, descriptionId: string | undefined): ReactNode {
    if (!descriptionId || !isValidElement(control) || typeof control.type === "symbol") {
        return control;
    }
    const element = control as ReactElement<HTMLAttributes<HTMLElement>>;
    if (element.props["aria-describedby"]) {
        return element;
    }
    return cloneElement(element, { "aria-describedby": descriptionId });
}

function focusInstead(event: MouseEvent<HTMLElement>) {
    const target = event.currentTarget.getAttribute("for");
    if (!target) return;
    event.preventDefault();
    document.getElementById(target)?.focus();
}

function SettingsRow({
    id,
    label,
    description,
    error,
    control,
    toggle = false,
    disabled = false,
    wide = false,
    className,
    children,
}: SettingsRowProps) {
    const descriptionId = id && description ? `${id}-description` : undefined;
    const pressable = toggle && !disabled;
    const LabelTag = id ? "label" : "span";
    const layout = toggle ? "toggle" : wide ? "wide" : "normal";
    return (
        <div data-slot="settings-row" className={cn("@container/settings-row py-0.5", className)}>
            <div
                data-slot="settings-row-body"
                data-toggle={toggle || undefined}
                data-disabled={disabled || undefined}
                className={cn(
                    "relative -mx-2.5 flex justify-between gap-x-6 gap-y-2 rounded-md px-2.5 py-3",
                    BODY_LAYOUT[layout],
                    pressable && "hover:bg-secondary has-[:focus-visible]:bg-secondary",
                )}
            >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <LabelTag
                        htmlFor={id}
                        onClick={toggle ? undefined : focusInstead}
                        className={cn(
                            "text-sm font-medium select-none",
                            toggle && "after:absolute after:inset-0 after:rounded-md",
                            pressable ? "cursor-pointer" : "cursor-default",
                        )}
                    >
                        {label}
                    </LabelTag>
                    {description ? (
                        <p id={descriptionId} className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
                <div
                    data-slot="settings-row-control"
                    className={cn(
                        "relative z-10 flex shrink-0 items-center justify-start gap-2",
                        CONTROL_LAYOUT[layout],
                    )}
                >
                    {describedControl(control, descriptionId)}
                </div>
            </div>
            {children}
        </div>
    );
}

function SettingsGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            data-slot="settings-group"
            className={cn("-my-3 flex flex-col divide-y", className)}
            {...props}
        />
    );
}

export { SettingsGroup, SettingsRow, type SettingsRowProps };
