import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

/**
 * Pre-styled `sonner` Toaster wrapper. Drop one `<Toaster />` into your app's
 * root layout (e.g. `__root.tsx`) and use `import { toast } from "sonner"`
 * anywhere to dispatch notifications. Picks up the live theme via CSS vars,
 * so toasts stay readable in light + dark + every brand style.
 *
 *   import { Toaster } from "@offbeatport/microsaas-core/ui";
 *   import { toast } from "sonner";
 *
 *   <Toaster />
 *   toast.success("Saved");
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="system"
      position="bottom-right"
      richColors={false}
      closeButton
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "!bg-field !text-fg !border !border-border-strong !shadow-card !rounded-md !font-sans",
          title: "!font-medium !text-[13px]",
          description: "!text-fg-muted !text-[12px]",
          actionButton:
            "!bg-primary !text-primary-fg !rounded-sm !px-2 !py-1 !text-[12px]",
          cancelButton:
            "!bg-transparent !text-fg-muted !rounded-sm !px-2 !py-1 !text-[12px]",
          closeButton:
            "!bg-field !border-border-strong !text-fg-muted hover:!bg-hover",
          success: "!border-success/30",
          error: "!border-danger/30",
          warning: "!border-warning/30",
          info: "!border-border-strong",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
