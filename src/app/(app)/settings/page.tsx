import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "設定" };

export default function SettingsPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <SettingsView />
    </ClientOnly>
  );
}
