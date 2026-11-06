"use client";

import * as React from "react";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "warning";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, "id">) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE: Record<
  ToastTone,
  { bg: string; Icon: typeof Info }
> = {
  success: { bg: "bg-lime", Icon: CircleCheck },
  info: { bg: "bg-white", Icon: Info },
  warning: { bg: "bg-coral", Icon: CircleAlert },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-100 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
      >
        {items.map((t) => {
          const { bg, Icon } = TONE[t.tone];
          return (
            <div
              key={t.id}
              className={cn(
                "animate-pop-in border-ink pointer-events-auto flex w-full items-start gap-3 border-2 p-3 shadow-brutal sm:w-80",
                bg,
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed break-words">
                    {t.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="hover:bg-ink/10 -m-1 shrink-0 p-1"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
