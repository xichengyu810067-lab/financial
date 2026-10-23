"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function ToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="secondary"
      size="sm"
      className="bg-card ring-1 ring-border hover:bg-muted"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "切換為淺色" : "切換為深色"}
      title={isDark ? "切換為淺色" : "切換為深色"}
    >
      {isDark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
      <span className="hidden sm:inline">{isDark ? "深色" : "淺色"}</span>
    </Button>
  );
}

/** 深淺色切換（主題在瀏覽器端才知道，伺服器先出骨架） */
export function ThemeToggle() {
  return (
    <ClientOnly fallback={<Skeleton className="h-8 w-16 rounded-full" />}>
      <ToggleButton />
    </ClientOnly>
  );
}
