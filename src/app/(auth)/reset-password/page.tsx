import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "重設密碼" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
