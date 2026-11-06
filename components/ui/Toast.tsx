"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Check, X } from "@/app/icons";

type Toast = { id: number; msg: string; kind: "success" | "error" | "info" };
type Ctx = { toast: (msg: string, kind?: Toast["kind"], ms?: number) => void };

const ToastCtx = createContext<Ctx>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

let seq = 0;

// Toasts slide in bottom-right, auto-dismiss (default 4s, override via ms), manual close X.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setItems((x) => x.filter((t) => t.id !== id)), []);
  const toast = useCallback((msg: string, kind: Toast["kind"] = "success", ms = 4000) => {
    const id = ++seq;
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => remove(id), ms);
  }, [remove]);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === "success" && <Check size={16} />}
            <span>{t.msg}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
