import type * as React from "react";

import { cn } from "../lib/cn";
import { Label } from "./label";

type FieldProps = {
    id: string;
    label: React.ReactNode;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
};

function Field({ id, label, hint, error, className, children }: FieldProps) {
    return (
        <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
            <Label htmlFor={id}>{label}</Label>
            {children}
            {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div data-slot="field-group" className={cn("flex flex-col gap-5", className)} {...props} />
    );
}

export { Field, FieldGroup, type FieldProps };
