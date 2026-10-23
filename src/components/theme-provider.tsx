"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ACCENT_STORAGE_KEY, ACCENTS, DEFAULT_ACCENT, type AccentId } from "@/lib/brand";

interface AccentContextValue {
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
}

const AccentContext = createContext<AccentContextValue | null>(null);

function isAccentId(value: string | null): value is AccentId {
  return ACCENTS.some((a) => a.id === value);
}

function readStoredAccent(): AccentId {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentId(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/**
 * 深淺色（next-themes，以 html.dark 切換）與主題色（html[data-accent]）。
 * 主題色存在 localStorage；layout 的 inline script 會在第一次繪製前先套上，避免閃一下。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>(readStoredAccent);

  const setAccent = (next: AccentId) => {
    setAccentState(next);
    document.documentElement.dataset.accent = next;
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AccentContext.Provider value={{ accent, setAccent }}>{children}</AccentContext.Provider>
    </NextThemesProvider>
  );
}

export function useAccent(): AccentContextValue {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error("useAccent 必須在 ThemeProvider 內使用");
  return ctx;
}

/** 放在 <head> 的 inline script：在 hydration 前就把主題色套到 html 上 */
export const accentInitScript = `(function(){try{var a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});if(a&&${JSON.stringify(ACCENTS.map((a) => a.id))}.indexOf(a)>-1){document.documentElement.setAttribute('data-accent',a);}}catch(e){}})();`;
