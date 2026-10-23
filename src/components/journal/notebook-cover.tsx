import { cn } from "cn";
import { coverColorOf, coverMaterialOf } from "@/lib/brand";

interface NotebookCoverProps {
  name: string;
  slogan?: string | null;
  /** ledgers.cover_material */
  material: string | null | undefined;
  /** ledgers.cover_color */
  color: string | null | undefined;
  year?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * 筆記本封面：顏色 + 材質紋理、書背、主題漸層的鬆緊帶、書籤、頁緣，
 * 中間一張手寫標籤寫帳本名稱與標語。封面頁與設定頁的預覽共用。
 */
export function NotebookCover({ name, slogan, material, color, year, size = "lg", className }: NotebookCoverProps) {
  const palette = coverColorOf(color);
  const texture = `cover-${coverMaterialOf(material)}`;
  const label = {
    sm: "left-[18%] top-[22%] w-[64%] p-2 rounded-[3px]",
    md: "left-[20%] top-[24%] w-[62%] p-3.5 rounded-[4px]",
    lg: "left-[20%] top-[24%] w-[62%] p-5 sm:p-6 rounded-[6px]",
  }[size];
  const nameClass = {
    sm: "text-[13px]",
    md: "text-[22px]",
    lg: "text-[30px] sm:text-[40px]",
  }[size];
  const sloganClass = {
    sm: "text-[8px]",
    md: "text-[12px]",
    lg: "text-[14px] sm:text-[17px]",
  }[size];
  const frame = {
    sm: "h-[156px] w-[120px] rounded-[4px_8px_8px_4px]",
    md: "h-[310px] w-[240px] rounded-[6px_14px_14px_6px]",
    lg: "h-[388px] w-[300px] rounded-[8px_18px_18px_8px] sm:h-[544px] sm:w-[420px] sm:rounded-[10px_22px_22px_10px]",
  }[size];
  const spineWidth = { sm: "w-2", md: "w-4", lg: "w-5 sm:w-7" }[size];
  const bandClass = { sm: "right-[12%] w-1", md: "right-[12%] w-2", lg: "right-[12%] w-2.5 sm:w-3.5" }[size];
  const labelBg = palette.id === "brown" ? "#F3E6C9" : "#FFFDF9";
  const labelInk = palette.id === "brown" ? "#3B2A20" : "#2B2420";

  return (
    <div
      className={cn("relative shrink-0 select-none shadow-[0_24px_48px_rgba(43,36,32,0.28)]", frame, texture, className)}
      style={{ backgroundColor: palette.hex }}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 rounded-l-[inherit] border-r border-dashed border-white/25", spineWidth)} style={{ backgroundColor: palette.spine }} />
      <span aria-hidden className={cn("absolute inset-y-0 bg-accent-gradient opacity-90", bandClass)} />
      {size !== "sm" && (
        <span
          aria-hidden
          className="absolute inset-y-3 -right-2 w-2 rounded-r-sm"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, #F7F1E6 0 2px, #DCD2C2 2px 3px)" }}
        />
      )}
      <div className={cn("absolute -rotate-1 shadow-[0_6px_16px_rgba(0,0,0,0.22)]", label)} style={{ backgroundColor: labelBg, color: labelInk }}>
        {year && size !== "sm" && <div className="text-[11px] tracking-[0.2em] opacity-70">{year}</div>}
        <div className={cn("font-hand font-bold leading-tight", nameClass, size !== "sm" && "mt-1")}>{name}</div>
        {slogan && <div className={cn("mt-2 font-hand opacity-75", sloganClass)}>{slogan}</div>}
      </div>
    </div>
  );
}
