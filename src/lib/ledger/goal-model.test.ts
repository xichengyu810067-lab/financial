import { describe, expect, it } from "vitest";
import {
  coverGoalLine,
  forecastSentence,
  goalReachedByDeposit,
  goalReachedBySave,
  goalStatus,
  goalsToMarkAchieved,
  monthDiff,
  pickFeaturedGoal,
  sortGoalStatuses,
  type Goal,
} from "./goal-model";

const TODAY = "2026-11-18";

const goal = (overrides: Partial<Goal> & Pick<Goal, "id" | "name" | "target_amount">): Goal => ({
  ledger_id: "L",
  account_id: null,
  achieved_at: null,
  created_at: "2026-01-01T00:00:00Z",
  is_archived: false,
  note: null,
  sort_order: 0,
  target_date: null,
  ...overrides,
});

const status = (g: Goal, saved: number, saved90d = 0) => goalStatus(g, { goalId: g.id, saved, saved90d }, TODAY);

describe("monthDiff", () => {
  it("跨年也算得對", () => {
    expect(monthDiff("2026-11", "2027-02")).toBe(3);
    expect(monthDiff("2026-11", "2026-11")).toBe(0);
    expect(monthDiff("2027-01", "2026-12")).toBe(-1);
  });
});

describe("goalStatus", () => {
  it("進度、剩餘與每月速度", () => {
    const s = status(goal({ id: "a", name: "日本旅行", target_amount: 50000 }), 31000, 9000);
    expect(s.saved).toBe(31000);
    expect(s.remaining).toBe(19000);
    expect(s.percent).toBe(62);
    expect(s.monthlyPace).toBe(3000);
    expect(s.achieved).toBe(false);
  });

  it("差一點點也不會顯示 100%", () => {
    expect(status(goal({ id: "a", name: "x", target_amount: 1000 }), 999.9).percent).toBe(99);
  });

  it("已存 ≥ 目標就是達標，比例封頂 1", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 1000 }), 1200);
    expect(s.achieved).toBe(true);
    expect(s.ratio).toBe(1);
    expect(s.percent).toBe(100);
    expect(s.forecast.kind).toBe("achieved");
  });

  it("記過達標日之後，餘額掉下來也還是達標", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 1000, achieved_at: "2026-10-01" }), 200);
    expect(s.achieved).toBe(true);
    expect(forecastSentence(s)).toBe("2026/10/1 達標");
  });

  it("負的 90 天變化（綁帳戶餘額變少）視為沒有存入", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 1000, account_id: "bank" }), 500, -300);
    expect(s.monthlyPace).toBe(0);
    expect(s.forecast).toEqual({ kind: "stalled", neededPerMonth: null });
    expect(forecastSentence(s)).toBe("最近三個月沒有存入");
  });
});

describe("預測", () => {
  it("沒有目標日：本月 + ceil(剩餘 ÷ 每月速度)", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 50000 }), 31000, 9000);
    // 剩 19000，每月 3000 → 7 個月 → 2027-06
    expect(s.forecast).toEqual({ kind: "projected", month: "2027-06", onTrack: null, lateMonths: 0, neededPerMonth: null });
    expect(forecastSentence(s)).toBe("照最近三個月的速度，預計 2027 年 6 月達標");
  });

  it("速度除不盡時不會多進一個月", () => {
    // 剩 2000，90 天存 1000（每月 333.33…）→ 剛好 6 個月 → 2027-05
    const s = status(goal({ id: "a", name: "x", target_amount: 3000 }), 1000, 1000);
    expect(s.monthlyPace).toBe(333.33);
    expect(s.forecast).toMatchObject({ kind: "projected", month: "2027-05" });
  });

  it("趕得上目標日", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 50000, target_date: "2027-08-31" }), 31000, 9000);
    expect(s.forecast).toMatchObject({ kind: "projected", month: "2027-06", onTrack: true, lateMonths: 0 });
    expect(forecastSentence(s)).toBe("預計 2027 年 6 月達標，趕得上目標日");
  });

  it("趕不上：晚幾個月、每月要存多少（本月到目標月含頭尾）", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 50000, target_date: "2027-03-15" }), 31000, 9000);
    // 預估 2027-06，目標 2027-03 → 晚 3 個月；11 月到 3 月共 5 個月 → 19000 ÷ 5 = 3800
    expect(s.forecast).toEqual({ kind: "projected", month: "2027-06", onTrack: false, lateMonths: 3, neededPerMonth: 3800 });
    expect(forecastSentence(s)).toBe("照這速度會晚 3 個月，每月要存 $3,800 才趕得上");
  });

  it("沒有存入但有目標日：附上每月要存多少", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 12000, target_date: "2027-04-30" }), 0, 0);
    // 11 月到 4 月共 6 個月 → 2000
    expect(s.forecast).toEqual({ kind: "stalled", neededPerMonth: 2000 });
    expect(forecastSentence(s)).toBe("最近三個月沒有存入；每月要存 $2,000 才趕得上");
  });

  it("目標日已過還沒達標", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 1000, target_date: "2026-10-31" }), 400, 300);
    expect(s.forecast.kind).toBe("overdue");
    expect(forecastSentence(s)).toBe("已過目標日，還差 $600");
  });

  it("目標日就是今天也還算趕得上的這個月", () => {
    const s = status(goal({ id: "a", name: "x", target_amount: 1000, target_date: TODAY }), 400, 0);
    expect(s.forecast).toEqual({ kind: "stalled", neededPerMonth: 600 });
  });
});

describe("pickFeaturedGoal", () => {
  it("沒有目標或全部封存就是 null", () => {
    expect(pickFeaturedGoal([], TODAY)).toBeNull();
    expect(pickFeaturedGoal([status(goal({ id: "a", name: "x", target_amount: 100, is_archived: true }), 10)], TODAY)).toBeNull();
  });

  it("今天剛達標的優先", () => {
    const list = [
      status(goal({ id: "a", name: "旅行", target_amount: 100, target_date: "2026-12-01" }), 10),
      status(goal({ id: "b", name: "電腦", target_amount: 100, achieved_at: TODAY }), 100),
    ];
    expect(pickFeaturedGoal(list, TODAY)?.goal.id).toBe("b");
  });

  it("有目標日的取最快到期，不管進度", () => {
    const list = [
      status(goal({ id: "a", name: "旅行", target_amount: 100 }), 90),
      status(goal({ id: "b", name: "電腦", target_amount: 100, target_date: "2027-05-01" }), 10),
      status(goal({ id: "c", name: "相機", target_amount: 100, target_date: "2027-02-01" }), 20),
    ];
    expect(pickFeaturedGoal(list, TODAY)?.goal.id).toBe("c");
  });

  it("都沒有目標日：取進度最高", () => {
    const list = [
      status(goal({ id: "a", name: "旅行", target_amount: 1000 }), 300),
      status(goal({ id: "b", name: "電腦", target_amount: 100 }), 80),
    ];
    expect(pickFeaturedGoal(list, TODAY)?.goal.id).toBe("b");
  });

  it("全部都達標：取最近達標的", () => {
    const list = [
      status(goal({ id: "a", name: "旅行", target_amount: 100, achieved_at: "2026-09-01" }), 100),
      status(goal({ id: "b", name: "電腦", target_amount: 100, achieved_at: "2026-10-01" }), 100),
    ];
    expect(pickFeaturedGoal(list, TODAY)?.goal.id).toBe("b");
  });

  it("封存的不算", () => {
    const list = [
      status(goal({ id: "a", name: "旅行", target_amount: 100, target_date: "2026-12-01", is_archived: true }), 10),
      status(goal({ id: "b", name: "電腦", target_amount: 100 }), 10),
    ];
    expect(pickFeaturedGoal(list, TODAY)?.goal.id).toBe("b");
  });
});

describe("sortGoalStatuses / coverGoalLine / goalsToMarkAchieved", () => {
  it("未達標照 sort_order，已達標放最後", () => {
    const list = [
      status(goal({ id: "done", name: "完成", target_amount: 100, achieved_at: "2026-10-01" }), 100),
      status(goal({ id: "b", name: "b", target_amount: 100, sort_order: 2 }), 0),
      status(goal({ id: "a", name: "a", target_amount: 100, sort_order: 1 }), 0),
    ];
    expect(sortGoalStatuses(list).map((s) => s.goal.id)).toEqual(["a", "b", "done"]);
  });

  it("封面一行", () => {
    expect(coverGoalLine(status(goal({ id: "a", name: "日本旅行", target_amount: 50000 }), 31000))).toBe("日本旅行 62%");
    expect(coverGoalLine(null)).toBeNull();
  });

  it("只挑出已存夠但還沒記達標日的", () => {
    const list = [
      status(goal({ id: "a", name: "a", target_amount: 100 }), 120),
      status(goal({ id: "b", name: "b", target_amount: 100, achieved_at: "2026-10-01" }), 120),
      status(goal({ id: "c", name: "c", target_amount: 100 }), 50),
    ];
    expect(goalsToMarkAchieved(list).map((s) => s.goal.id)).toEqual(["a"]);
  });
});

describe("達標回饋的觸發", () => {
  const bound = status(goal({ id: "trip", name: "日本旅行", target_amount: 10000, account_id: "savings" }), 9500);
  const base = { kind: "transfer" as const, amount: 500, date: TODAY, today: TODAY, toAccountId: "savings", statuses: [bound], isEdit: false };

  it("轉帳進綁定帳戶剛好達標", () => {
    expect(goalReachedBySave(base)?.goal.id).toBe("trip");
  });

  it("收入直接進綁定帳戶也算", () => {
    expect(goalReachedBySave({ ...base, kind: "income" })?.goal.id).toBe("trip");
  });

  it("還不夠、轉到別的帳戶、支出、編輯、未來日期都不算", () => {
    expect(goalReachedBySave({ ...base, amount: 499 })).toBeNull();
    expect(goalReachedBySave({ ...base, toAccountId: "cash" })).toBeNull();
    expect(goalReachedBySave({ ...base, kind: "expense" })).toBeNull();
    expect(goalReachedBySave({ ...base, isEdit: true })).toBeNull();
    expect(goalReachedBySave({ ...base, date: "2026-11-19" })).toBeNull();
    expect(goalReachedBySave({ ...base, statuses: undefined })).toBeNull();
  });

  it("已經達標過的不會再觸發", () => {
    const done = status(goal({ id: "trip", name: "日本旅行", target_amount: 10000, account_id: "savings", achieved_at: "2026-10-01" }), 9500);
    expect(goalReachedBySave({ ...base, statuses: [done] })).toBeNull();
  });

  it("手動存入", () => {
    const manual = status(goal({ id: "pc", name: "電腦", target_amount: 3000 }), 2000);
    expect(goalReachedByDeposit(manual, 1000, TODAY, TODAY)).toBe(true);
    expect(goalReachedByDeposit(manual, 999, TODAY, TODAY)).toBe(false);
    expect(goalReachedByDeposit(manual, 1000, "2026-11-20", TODAY)).toBe(false);
  });
});
