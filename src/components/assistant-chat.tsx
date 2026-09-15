"use client";

import { useState, useTransition } from "react";
import type { LocationScope } from "@/lib/location";

type ChatTurn = { role: "user" | "assistant"; content: string };

export function AssistantChat({
  scope,
  suggestions,
}: {
  scope: LocationScope;
  suggestions: string[];
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setInput("");
    setError(null);
    setTurns((t) => [...t, { role: "user", content: q }]);
    start(async () => {
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, scope }),
        });
        const data = (await res.json()) as { answer?: string; error?: string; source?: string };
        if (!res.ok || !data.answer) {
          setError(data.error || "Could not answer.");
          return;
        }
        const prefix = data.source === "llm" ? "" : "";
        setTurns((t) => [...t, { role: "assistant", content: prefix + data.answer }]);
      } catch {
        setError("Network error talking to the assistant.");
      }
    });
  }

  return (
    <main className="flex flex-col px-4 py-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            className="min-h-10 rounded-full border border-line bg-card px-3 text-left text-xs font-medium"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="min-h-64 space-y-3">
        {turns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-6 text-sm leading-6 text-muted">
            Ask about today&apos;s sales, fees, labor, food cost, delivery mix, or messages that
            need approval. The location switcher above is the filter — ALL never hides which
            store a number belongs to.
          </p>
        ) : null}
        {turns.map((turn, i) => (
          <div
            key={`${turn.role}-${i}`}
            className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-6 ${
              turn.role === "user"
                ? "ml-8 bg-chile font-medium text-black"
                : "mr-4 border border-line bg-card"
            }`}
          >
            {turn.content}
          </div>
        ))}
        {pending ? <p className="text-sm text-muted">Looking at the books…</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
      <form
        className="sticky bottom-24 mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question"
          className="min-h-12 flex-1 rounded-2xl border border-line bg-card px-4 text-base outline-none ring-chile/40 focus:ring-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-2xl bg-chile px-4 text-sm font-extrabold text-black disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </main>
  );
}
