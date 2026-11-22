"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanFace } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";

export function FaceIdSignIn() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("This browser cannot use Face ID. Sign in with your password.");
      }
      const optionsResponse = await fetch("/api/passkey/login/options", { method: "POST" });
      const optionsJSON = await optionsResponse.json();
      if (!optionsResponse.ok) {
        throw new Error(optionsJSON.error ?? "Face ID sign-in did not start.");
      }
      const assertion = await startAuthentication({ optionsJSON });
      const verifyResponse = await fetch("/api/passkey/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(assertion),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verified.error ?? "Face ID did not match.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(faceIdError(caught));
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-chile px-4 text-base font-extrabold text-ink shadow-[0_12px_30px_-18px_rgba(0,0,0,0.7)] disabled:opacity-60"
      >
        <ScanFace size={22} aria-hidden />
        {pending ? "Waiting for Face ID…" : "Sign in with Face ID"}
      </button>
      {error ? <p className="mt-3 rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function faceIdError(error: unknown): string {
  if (error instanceof Error && error.message && !error.message.startsWith("The operation")) {
    if (error.name === "NotAllowedError") return "Face ID was cancelled. You can use your password.";
    if (error.name === "NotSupportedError") return "This browser cannot use Face ID.";
    return error.message;
  }
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError") return "Face ID was cancelled. You can use your password.";
  return "Face ID did not finish. Use your password.";
}
