import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoriesView } from "./categories-view";

export const metadata: Metadata = { title: "類別" };

export default function CategoriesPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <CategoriesView />
    </ClientOnly>
  );
}
