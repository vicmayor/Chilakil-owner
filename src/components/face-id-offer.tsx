"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanFace } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

export function FaceIdOffer({ enabled, persist = false }: { enabled: boolean; persist?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("This browser cannot use Face ID.");
      }
      const optionsResponse = await fetch("/api/passkey/register/options", { method: "POST" });
      const optionsJSON = await optionsResponse.json();
      if (!optionsResponse.ok) {
        throw new Error(optionsJSON.error ?? "Face ID setup did not start.");
      }
      const attestation = await startRegistration({ optionsJSON });
      const verifyResponse = await fetch("/api/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(attestation),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verified.error ?? "Face ID could not be saved.");
      }
      setOn(true);
      router.refresh();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPending(false);
    }
  }

  if (on && !persist) return null;

  if (on) {
    return (
      <section className="flex items-center gap-3 rounded-[1.5rem] border border-line bg-card px-4 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-chile text-ink">
          <ScanFace size={22} aria-hidden />
        </span>
        <div>
          <p className="font-extrabold leading-tight">Face ID is on</p>
          <p className="text-xs text-muted">Next visit can use Sign in with Face ID. Password still works.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] bg-ink px-4 py-4 text-white">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-chile text-ink">
          <ScanFace size={22} aria-hidden />
        </span>
        <div>
          <p className="text-base font-extrabold leading-tight">Enable Face ID</p>
          <p className="mt-1 text-sm leading-5 text-white/75">
            Sign in with your face next time. Your password stays as a backup.
          </p>
        </div>
      </div>
      {error ? <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}
      <button
        type="button"
        onClick={enable}
        disabled={pending}
        className="mt-3 flex w-full items-center justify-center rounded-2xl bg-chile px-4 text-base font-extrabold text-ink disabled:opacity-60"
      >
        {pending ? "Waiting for Face ID…" : "Enable Face ID"}
      </button>
    </section>
  );
}

function message(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError") return "Face ID was cancelled.";
  if (name === "InvalidStateError") return "This iPhone already has Face ID for Chilakil.";
  if (error instanceof Error && error.message) return error.message;
  return "Face ID could not be turned on.";
}
