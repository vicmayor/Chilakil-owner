"use client";

import { useActionState } from "react";
import type { loginAction } from "@/app/actions/auth";

type Props = {
  action: typeof loginAction;
};

export function LoginForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue="owner@chilakil.com"
          className="mt-1.5 w-full rounded-2xl border border-line bg-card px-4 text-base text-ink outline-none ring-chile/40 focus:ring-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded-2xl border border-line bg-card px-4 text-base text-ink outline-none ring-chile/40 focus:ring-2"
        />
      </label>
      {state?.error ? (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center rounded-2xl bg-chile px-4 text-base font-extrabold text-black disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
