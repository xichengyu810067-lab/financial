import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { ScanView } from "./scan-view";

export const metadata: Metadata = { title: "掃發票" };

export default function ScanPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <ScanView />
    </ClientOnly>
  );
}
