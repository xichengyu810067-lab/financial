import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, requireUser } from "@/lib/auth/dal";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "設定帳本" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <OnboardingGate />
    </Suspense>
  );
}

async function OnboardingGate() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile?.onboarded_at) redirect("/today");
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <OnboardingForm />
    </ClientOnly>
  );
}
