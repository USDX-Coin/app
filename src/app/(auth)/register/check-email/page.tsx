import { Suspense } from "react";
import { CheckEmail } from "@/components/auth/CheckEmail";

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmail />
    </Suspense>
  );
}
