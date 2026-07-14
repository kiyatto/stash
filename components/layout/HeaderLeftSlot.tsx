"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type HeaderLeftContextValue = {
  target: HTMLElement | null;
  setTarget: (node: HTMLElement | null) => void;
  overridden: boolean;
  setOverridden: (value: boolean) => void;
};

const HeaderLeftContext = createContext<HeaderLeftContextValue | null>(null);

export function HeaderLeftProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [overridden, setOverridden] = useState(false);
  const value = useMemo(
    () => ({ target, setTarget, overridden, setOverridden }),
    [target, overridden]
  );

  return (
    <HeaderLeftContext.Provider value={value}>
      {children}
    </HeaderLeftContext.Provider>
  );
}

function useHeaderLeftContext() {
  const ctx = useContext(HeaderLeftContext);
  if (!ctx) {
    throw new Error("HeaderLeft components must be used within HeaderLeftProvider");
  }
  return ctx;
}

export function HeaderLeftSlot({ fallback }: { fallback: ReactNode }) {
  const { setTarget, overridden } = useHeaderLeftContext();

  return (
    <div className="flex min-w-0 items-center">
      <div
        ref={setTarget}
        className={overridden ? "flex min-w-0 items-center" : "hidden"}
      />
      {overridden ? null : fallback}
    </div>
  );
}

/** Portals children into the app header left slot while mounted. */
export function HeaderLeft({ children }: { children: ReactNode }) {
  const { target, setOverridden } = useHeaderLeftContext();

  useLayoutEffect(() => {
    setOverridden(true);
    return () => setOverridden(false);
  }, [setOverridden]);

  if (!target) return null;
  return createPortal(children, target);
}
