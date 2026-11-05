"use client";

import type * as React from "react";
import { useRef, useState } from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";

export type DropZoneProps = {
    onFiles: (files: File[]) => void;
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
    title?: React.ReactNode;
    description?: React.ReactNode;
    activeTitle?: React.ReactNode;
    buttonLabel?: string;
    inputLabel?: string;
    className?: string;
    children?: React.ReactNode;
};

function carriesFiles(event: React.DragEvent): boolean {
    return Array.from(event.dataTransfer.types).includes("Files");
}

function DropZone({
    onFiles,
    accept,
    multiple = false,
    disabled = false,
    title = multiple ? "Drop files here" : "Drop a file here",
    description,
    activeTitle = "Drop to upload",
    buttonLabel = multiple ? "Choose files" : "Choose a file",
    inputLabel = multiple ? "Files to upload" : "File to upload",
    className,
    children,
}: DropZoneProps) {
    const input = useRef<HTMLInputElement>(null);
    const depth = useRef(0);
    const [over, setOver] = useState(false);
    const deliver = (list: FileList | null) => {
        const files = Array.from(list ?? []);
        if (files.length > 0) {
            onFiles(multiple ? files : files.slice(0, 1));
        }
    };
    const leave = () => {
        depth.current = 0;
        setOver(false);
    };
    return (
        <div
            data-slot="drop-zone"
            data-over={over || undefined}
            data-disabled={disabled || undefined}
            className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-card p-panel text-center",
                "data-over:border-solid data-over:border-ring data-over:bg-secondary",
                "data-disabled:pointer-events-none data-disabled:opacity-50",
                className,
            )}
            onDragEnter={(event) => {
                if (disabled || !carriesFiles(event)) return;
                event.preventDefault();
                depth.current += 1;
                setOver(true);
            }}
            onDragOver={(event) => {
                if (disabled || !carriesFiles(event)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={() => {
                depth.current = Math.max(depth.current - 1, 0);
                if (depth.current === 0) setOver(false);
            }}
            onDrop={(event) => {
                if (disabled || !carriesFiles(event)) return;
                event.preventDefault();
                leave();
                deliver(event.dataTransfer.files);
            }}
        >
            <div className="flex flex-col gap-1">
                <p className="text-base font-medium text-foreground">
                    {over ? activeTitle : title}
                </p>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => input.current?.click()}
            >
                {buttonLabel}
            </Button>
            {children}
            <input
                ref={input}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-label={inputLabel}
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                onChange={(event) => {
                    deliver(event.target.files);
                    event.target.value = "";
                }}
            />
        </div>
    );
}

export { DropZone };
