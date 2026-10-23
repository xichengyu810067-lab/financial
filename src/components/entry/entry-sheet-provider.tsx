"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ClientOnly } from "@/components/client-only";
import type { Entry } from "@/lib/ledger/entries";
import { EntrySheet } from "./entry-sheet";

export type EntrySheetMode = "new" | "edit" | "copy";

export type EntrySheetState =
  | { open: false; seq: number }
  | { open: true; seq: number; mode: EntrySheetMode; entry?: Entry };

interface EntrySheetApi {
  openNew: () => void;
  openEdit: (entry: Entry) => void;
  openCopy: (entry: Entry) => void;
  close: () => void;
}

const EntrySheetContext = createContext<EntrySheetApi | null>(null);

/**
 * 全站共用的記帳面板。任何頁面呼叫 useEntrySheet().openNew() 就能記一筆，
 * 面板本身只在瀏覽器端渲染（裡面有 TanStack Query）。
 */
export function EntrySheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EntrySheetState>({ open: false, seq: 0 });

  const api = useMemo<EntrySheetApi>(
    () => ({
      openNew: () => setState((s) => ({ open: true, seq: s.seq + 1, mode: "new" })),
      openEdit: (entry) => setState((s) => ({ open: true, seq: s.seq + 1, mode: "edit", entry })),
      openCopy: (entry) => setState((s) => ({ open: true, seq: s.seq + 1, mode: "copy", entry })),
      close: () => setState((s) => ({ open: false, seq: s.seq })),
    }),
    [],
  );

  return (
    <EntrySheetContext.Provider value={api}>
      {children}
      <ClientOnly>
        <EntrySheet state={state} onClose={api.close} />
      </ClientOnly>
    </EntrySheetContext.Provider>
  );
}

export function useEntrySheet(): EntrySheetApi {
  const ctx = useContext(EntrySheetContext);
  if (!ctx) throw new Error("useEntrySheet 必須在 EntrySheetProvider 內使用");
  return ctx;
}
