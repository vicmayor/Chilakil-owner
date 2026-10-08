import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";

export function AlertCard({
  tone,
  title,
  children,
  href,
}: {
  tone: "problem" | "notice";
  title: string;
  children?: ReactNode;
  href?: string;
}) {
  const problem = tone === "problem";
  const Icon = problem ? AlertTriangle : Info;
  const body = (
    <div className="flex gap-3">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          problem ? "bg-white text-danger" : "bg-white text-ink"
        }`}
      >
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-extrabold leading-5">{title}</p>
        {children ? <div className="mt-1 text-sm leading-5 text-ink/80">{children}</div> : null}
      </div>
    </div>
  );
  const className = `block rounded-3xl px-4 py-3.5 ${problem ? "bg-danger-soft text-danger" : "bg-warn-soft text-ink"}`;
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
