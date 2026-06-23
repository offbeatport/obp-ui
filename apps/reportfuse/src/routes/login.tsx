import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginBlock } from "@offbeatport/blocks/auth/login";
import { LogoMark } from "../components/logo-mark";
import { signIn } from "../lib/auth-client";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { getSession } = await import("../lib/auth-client");
    const session = await getSession();
    if (session?.data?.user) throw redirect({ to: "/dashboard" });
  },
  component: Login,
});

function Login() {
  return (
    <LoginBlock
      logo={<LogoMark size={40} />}
      title="Sign in to ReportFuse"
      subtitle="Unlock run history and saved column mappings."
      bottomNote="Free account - 10 normalizations/day, no card required."
      onGoogleSignIn={() => signIn.social({ provider: "google", callbackURL: "/dashboard" })}
    />
  );
}
