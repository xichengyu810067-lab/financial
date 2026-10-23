import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionsView } from "./transactions-view";

export const metadata: Metadata = { title: "交易" };

export default function TransactionsPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <TransactionsView />
    </ClientOnly>
  );
}
