export default function OwnerLoading() {
  return (
    <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))]" aria-busy="true" aria-live="polite">
      <div className="skeleton h-44 rounded-[1.75rem] bg-chile/40" />
      <div className="skeleton mt-4 h-48 rounded-[1.75rem]" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="skeleton h-24 rounded-3xl" />
        <div className="skeleton h-24 rounded-3xl" />
      </div>
      <p className="sr-only">Loading</p>
    </div>
  );
}
