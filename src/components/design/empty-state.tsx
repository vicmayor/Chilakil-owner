export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-line bg-card px-5 py-8 text-center shadow-[0_16px_40px_-28px_rgba(17,17,17,0.45)]">
      <p className="text-base font-extrabold">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-muted">{body}</p> : null}
    </div>
  );
}
