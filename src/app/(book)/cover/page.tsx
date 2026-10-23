import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverView } from "./cover-view";

export const metadata: Metadata = { title: "封面" };

export default function CoverPage() {
  return (
    <ClientOnly fallback={<Skeleton className="mx-auto mt-10 h-[544px] w-[420px] max-w-full rounded-[18px]" />}>
      <CoverView />
    </ClientOnly>
  );
}
