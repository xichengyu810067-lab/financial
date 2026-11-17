import { cn } from "cn";
import { Stamp } from "@/components/journal/stamp";
import { formatTWD } from "@/lib/ledger/format";
import { forecastSentence, type GoalStatus } from "@/lib/ledger/goal-model";

interface GoalProgressProps {
  status: GoalStatus;
  /** 綁定的帳戶名稱；手動目標是 null */
  accountName: string | null;
  className?: string;
}

/** 目標的進度：名稱、已存／目標、進度條、一句預測；達標時蓋「達標」章 */
export function GoalProgress({ status, accountName, className }: GoalProgressProps) {
  const { goal, saved, target, percent, achieved } = status;
  const late = status.forecast.kind === "overdue" || (status.forecast.kind === "projected" && status.forecast.onTrack === false);
  return (
    <div className={cn("relative grid gap-1.5", achieved && "pr-14", className)}>
      {achieved && <Stamp className="absolute top-0 right-0 border-income text-income">達標</Stamp>}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[15px] font-bold">{goal.name}</span>
        {!achieved && <span className="shrink-0 text-xs font-bold tabular-nums text-primary">{percent}%</span>}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        <span className="text-[18px] font-bold text-foreground">{formatTWD(saved)}</span> / {formatTWD(target)}
        <span className="ml-1.5">・{accountName ? `看「${accountName}」餘額` : "手動存入"}</span>
        {goal.target_date && <span className="ml-1.5">・目標日 {goal.target_date.replaceAll("-", "/")}</span>}
      </div>
      <div
        role="progressbar"
        aria-label={`${goal.name} 進度`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="relative h-2 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", achieved ? "bg-income" : "bg-accent-gradient")}
          style={{ width: `${Math.round(status.ratio * 100)}%` }}
        />
      </div>
      <p className={cn("text-xs", late ? "text-warning" : "text-muted-foreground")}>{forecastSentence(status)}</p>
    </div>
  );
}
