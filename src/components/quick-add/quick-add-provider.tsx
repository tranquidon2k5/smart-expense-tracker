"use client";

import * as React from "react";

interface QuickAddContextValue {
  /** Mở Ghi nhanh: desktop → focus ô ở thanh trên; mobile → mở hộp thoại */
  openQuickAdd: () => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const QuickAddContext = React.createContext<QuickAddContextValue | null>(null);

export function useQuickAdd() {
  const ctx = React.useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd phải nằm trong QuickAddProvider");
  return ctx;
}

const DESKTOP_QUERY = "(min-width: 768px)";

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const openQuickAdd = React.useCallback(() => {
    const input = inputRef.current;
    if (window.matchMedia(DESKTOP_QUERY).matches && input) {
      input.focus();
      input.select();
    } else {
      setDialogOpen(true);
    }
  }, []);

  const value = React.useMemo(
    () => ({ openQuickAdd, dialogOpen, setDialogOpen, inputRef }),
    [openQuickAdd, dialogOpen],
  );

  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>;
}
