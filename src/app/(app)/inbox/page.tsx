import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = { title: "待確認" };

export default function InboxPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <InboxView />
    </ClientOnly>
  );
}
