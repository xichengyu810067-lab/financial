"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/client-only";
import type { Feedback } from "@/lib/ledger/feedback";
import { useProfile } from "@/lib/ledger/queries";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { FEEDBACK_DURATION, FeedbackOverlay } from "./feedback-overlay";

interface FeedbackApi {
  /** 記帳成功後呼叫；提醒用 toast 一定會出，動畫看設定與系統的減少動態 */
  play: (feedback: Feedback) => void;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

type Current = { seq: number; feedback: Feedback } | null;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Current>(null);

  const api = useMemo<FeedbackApi>(
    () => ({
      play: (feedback) => {
        if (feedback.kind === "overspend" && feedback.alert) {
          toast.warning(feedback.alert.title, { description: feedback.alert.advice, duration: 3000 });
        }
        setCurrent((c) => ({ seq: (c?.seq ?? 0) + 1, feedback }));
      },
    }),
    [],
  );

  useEffect(() => {
    if (!current) return;
    const { seq, feedback } = current;
    const timer = window.setTimeout(() => setCurrent((c) => (c?.seq === seq ? null : c)), FEEDBACK_DURATION[feedback.kind]);
    return () => window.clearTimeout(timer);
  }, [current]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <ClientOnly>{current && <OverlayGate current={current} />}</ClientOnly>
    </FeedbackContext.Provider>
  );
}

/** 設定關掉就不畫；減少動態時 CSS 會把動畫拿掉只留靜態印章 */
function OverlayGate({ current }: { current: NonNullable<Current> }) {
  const { data: profile } = useProfile();
  const reducedMotion = usePrefersReducedMotion();
  if (profile?.animations_enabled === false) return null;
  if (reducedMotion && current.feedback.kind === "saving") return null;
  return <FeedbackOverlay feedback={current.feedback} seq={current.seq} />;
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback 必須在 FeedbackProvider 內使用");
  return ctx;
}
