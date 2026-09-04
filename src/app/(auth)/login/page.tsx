import { LoginForm } from "@/components/auth/LoginForm";
import { SessionExpiredNotice } from "@/components/shared/SessionExpiredNotice";

// `?sesi=habis` is set by ApiClientBridge when a 401 ends the session mid-use
// (B2). Read here rather than inside the form so the form keeps owning only the
// credentials it is given.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sesi?: string }>;
}) {
  const { sesi } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      {sesi === "habis" && <SessionExpiredNotice />}
      <LoginForm />
    </div>
  );
}
