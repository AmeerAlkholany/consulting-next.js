"use client";

import * as React from "react";
import { AlertCircle, Check, Info, TriangleAlert } from "lucide-react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export type ToastVariant = "default" | "success" | "warning" | "destructive";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastRecord extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** Status is never colour alone — each variant also has an icon and a label. */
const variantIcons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4" aria-hidden="true" />,
  success: <Check className="h-4 w-4" aria-hidden="true" />,
  warning: <TriangleAlert className="h-4 w-4" aria-hidden="true" />,
  destructive: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
};

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <Toaster>.");
  }
  return context;
}

/**
 * Toast host. Mounted once in the root layout so any client component can
 * announce the result of an action (ARCHITECTURE.md §30 — aria-live results).
 */
function Toaster({
  children,
  defaultDuration = 6000,
}: {
  children: React.ReactNode;
  defaultDuration?: number;
}) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    setToasts((current) => [...current, { ...options, id }]);
  }, []);

  const value = React.useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      <ToastProvider duration={defaultDuration} swipeDirection="right">
        {children}
        {toasts.map((item) => (
          <Toast
            key={item.id}
            variant={item.variant}
            duration={item.durationMs}
            onOpenChange={(open) => {
              if (!open) {
                dismiss(item.id);
              }
            }}
          >
            <span
              className={
                item.variant === "destructive"
                  ? "mt-0.5 shrink-0 text-danger"
                  : item.variant === "warning"
                    ? "mt-0.5 shrink-0 text-warning"
                    : item.variant === "success"
                      ? "mt-0.5 shrink-0 text-success"
                      : "mt-0.5 shrink-0 text-muted-foreground"
              }
            >
              {variantIcons[item.variant ?? "default"]}
            </span>
            <div className="flex flex-col">
              <ToastTitle>{item.title}</ToastTitle>
              {item.description ? <ToastDescription>{item.description}</ToastDescription> : null}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export { Toaster };
