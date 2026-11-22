import Image from "next/image";
import { loginAction } from "@/app/actions/auth";
import { FaceIdSignIn } from "@/components/face-id-sign-in";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <span className="w-fit rounded-[1.35rem] bg-chile p-1 ring-2 ring-ink">
          <Image src="/icon-192.png" alt="" width={72} height={72} priority className="h-[4.5rem] w-[4.5rem] rounded-[1.1rem]" />
        </span>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.28em] text-muted">Chilakil / Owner</p>
        <h1 className="font-display mt-2 text-6xl font-black uppercase leading-[0.86] tracking-tight">Welcome</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-6 text-muted">
          Glendale restaurant and Avondale trailer stay on separate books. Sign
          in to see today.
        </p>
        <FaceIdSignIn />
        <div className="mt-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          <span className="h-px flex-1 bg-line" />
          or password
          <span className="h-px flex-1 bg-line" />
        </div>
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
