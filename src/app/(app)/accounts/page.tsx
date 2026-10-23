import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountsView } from "./accounts-view";

export const metadata: Metadata = { title: "帳戶" };

export default function AccountsPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <AccountsView />
    </ClientOnly>
  );
}
