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

// Confirm-before-acting wrapper. Wrap any trigger (usually a Button) to require a
// modal confirmation; awaits onConfirm, then closes.
export function ConfirmDialog({
    trigger,
    title,
    description,
    confirmLabel,
    destructive,
    onConfirm,
}: {
    trigger: ReactNode;
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => Promise<unknown> | unknown;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-md">
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
