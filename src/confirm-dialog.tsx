import { type ReactNode, useState } from "react";
import {
    Button,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./primitives";

export function ConfirmDialog({
    trigger,
    open: openProp,
    onOpenChange,
    title,
    description,
    confirmLabel,
    destructive,
    onConfirm,
}: {
    trigger?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => Promise<unknown> | unknown;
}) {
    const [innerOpen, setInnerOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const open = openProp ?? innerOpen;
    const setOpen = (next: boolean) => {
        if (openProp === undefined) {
            setInnerOpen(next);
        }
        onOpenChange?.(next);
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger !== undefined && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                        variant={destructive ? "destructive" : "default"}
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            await onConfirm();
                            setBusy(false);
                            setOpen(false);
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
