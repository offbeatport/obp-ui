import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface State {
  open: boolean;
  message: string;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: "danger" | "default";
}

const DEFAULT_STATE: State = {
  open: false,
  message: "",
  title: "Are you sure?",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  variant: "default",
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((message, options = {}) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        message,
        title: options.title ?? "Are you sure?",
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        variant: options.variant ?? "default",
      });
    });
  }, []);

  function respond(value: boolean) {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(value);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={state.open}
        onClose={() => respond(false)}
        title={state.title}
        width={380}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => respond(false)}>
              {state.cancelLabel}
            </Button>
            <Button
              variant={state.variant === "danger" ? "destructive" : "primary"}
              size="sm"
              onClick={() => respond(true)}
            >
              {state.confirmLabel}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--fg-muted)", lineHeight: 1.6 }}>
          {state.message}
        </p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return fn;
}
