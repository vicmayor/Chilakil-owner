export function BrandLogo({
  size = "full",
  className = "",
}: {
  size?: "full" | "header";
  className?: string;
}) {
  const dims =
    size === "header"
      ? "h-8 w-auto max-w-[148px] object-contain object-left"
      : "h-auto w-full max-w-[340px] object-contain object-left";
  return (
    // Official lockup is designed on black — keep that plate behind the asset.
    <div className={`bg-black ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/chilakil-logo.png" alt="Chilakil To Go" className={dims} />
    </div>
  );
}
