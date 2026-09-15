import { loginAction } from "@/app/actions/auth";
import { LoginForm } from "@/components/login-form";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-black px-5 pb-[env(safe-area-inset-bottom)] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <BrandLogo />
        <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.28em] text-chile">
          Owner
        </p>
        <p className="mt-3 max-w-sm text-[15px] leading-6 text-muted">
          Glendale restaurant and Avondale trailer stay on separate books. Sign
          in to see today.
        </p>
        <LoginForm action={loginAction} />
        <p className="mt-8 text-xs leading-5 text-muted">
          Local seed login is in <code className="font-medium text-ink">.env.example</code>
          {" "}
          (<span className="text-ink">owner@chilakil.com</span>). Do not ship that
          password outside this machine.
        </p>
      </div>
    </div>
  );
}
