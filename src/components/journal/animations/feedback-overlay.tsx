"use client";

import { cn } from "cn";
import { formatTWD } from "@/lib/ledger/format";
import type { Feedback } from "@/lib/ledger/feedback";

/** 各段動畫的長度（毫秒），含淡出 */
export const FEEDBACK_DURATION: Record<Feedback["kind"], number> = { saving: 1100, stamp: 800, overspend: 1200 };

interface FeedbackOverlayProps {
  feedback: Feedback;
  /** 讓同一種動畫連續播放時重新掛載 */
  seq: number;
}

/**
 * 記帳後的回饋：固定在畫面中央、不擋點擊，依種類畫撲滿、印章或紙鈔。
 * 動畫全部是 CSS 關鍵影格（globals.css 的 .fb-*），減少動態時只剩靜態印章。
 */
export function FeedbackOverlay({ feedback, seq }: FeedbackOverlayProps) {
  const outDelay = `${(FEEDBACK_DURATION[feedback.kind] - 300) / 1000}s`;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center" aria-hidden>
      <div
        key={`${feedback.kind}-${seq}`}
        className="fb-card flex min-w-56 max-w-[min(90vw,20rem)] flex-col items-center gap-2 rounded-[18px] bg-card/95 px-6 py-5 text-center shadow-[0_18px_40px_rgba(43,36,32,0.22)] ring-1 ring-border"
        style={{ "--fb-out": outDelay } as React.CSSProperties}
      >
        {feedback.kind === "saving" && <SavingScene feedback={feedback} />}
        {feedback.kind === "stamp" && <StampScene feedback={feedback} />}
        {feedback.kind === "overspend" && <OverspendScene feedback={feedback} />}
      </div>
    </div>
  );
}

function SavingScene({ feedback }: { feedback: Feedback }) {
  return (
    <>
      <div className="relative h-28 w-36">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="fb-coin absolute top-2 size-5 rounded-full border-2 border-[#C99A1E] bg-[#F5C542]"
            style={{ left: `${44 + i * 14}%`, animationDelay: `${i * 0.12}s` }}
          />
        ))}
        <PiggyBank className="fb-piggy absolute bottom-0 left-1/2 w-28 -translate-x-1/2" />
      </div>
      <div className="fb-amount">
        <div className="text-[22px] font-bold text-income tabular-nums">+{formatTWD(feedback.amount)}</div>
        <div className="text-xs text-muted-foreground">存進{feedback.label}</div>
      </div>
    </>
  );
}

function StampScene({ feedback }: { feedback: Feedback }) {
  return (
    <>
      <Stamp tone="pink" />
      <div className="fb-bounce">
        <div className="text-sm font-bold">{feedback.label}</div>
        <div className="text-xs text-muted-foreground tabular-nums">−{formatTWD(feedback.amount)}</div>
      </div>
    </>
  );
}

function OverspendScene({ feedback }: { feedback: Feedback }) {
  return (
    <>
      <div className="relative h-20 w-36">
        <Banknote className="fb-bill absolute top-6 left-1/2 w-16 -translate-x-1/2" />
        <Stamp tone="orange" className="absolute right-0 bottom-0" />
      </div>
      <div className="text-sm font-bold text-warning">{feedback.label} −{formatTWD(feedback.amount)}</div>
      <div className="text-xs text-muted-foreground">{feedback.alert?.title ?? "這筆讓這個類別超過基準線了"}</div>
    </>
  );
}

function Stamp({ tone, className }: { tone: "pink" | "orange"; className?: string }) {
  return (
    <span
      className={cn(
        "fb-stamp inline-flex size-16 items-center justify-center rounded-full border-[3px] font-hand text-[18px] font-bold",
        tone === "pink" ? "border-primary text-primary shadow-[0_0_0_4px_var(--accent-tint)]" : "border-warning text-warning shadow-[0_0_0_4px_color-mix(in_srgb,var(--warning)_18%,transparent)]",
        className,
      )}
    >
      已記
    </span>
  );
}

function PiggyBank({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 60" className={className} aria-hidden>
      <ellipse cx="45" cy="36" rx="32" ry="20" fill="#F2B8D4" />
      <circle cx="72" cy="30" r="11" fill="#F2B8D4" />
      <ellipse cx="78" cy="31" rx="5" ry="4" fill="#E58FB9" />
      <path d="M28 12l8 10h-14z" fill="#F2B8D4" />
      <rect x="24" y="52" width="8" height="7" rx="2" fill="#E58FB9" />
      <rect x="56" y="52" width="8" height="7" rx="2" fill="#E58FB9" />
      <rect x="40" y="16" width="14" height="3" rx="1.5" fill="#C2187A" />
      <circle cx="66" cy="27" r="1.6" fill="#2B2420" />
    </svg>
  );
}

function Banknote({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 46 26" className={className} aria-hidden>
      <rect x="1" y="1" width="44" height="24" rx="4" fill="#D7E8D0" stroke="#5E8C5A" strokeWidth="2" />
      <circle cx="23" cy="13" r="6" fill="none" stroke="#5E8C5A" strokeWidth="2" />
    </svg>
  );
}
