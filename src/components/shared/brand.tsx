import Link from "next/link";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return <Link href="/" aria-label="ACTIVANT, ir al inicio" className={cn("inline-flex min-h-11 items-center gap-2.5 rounded-md", className)}>
    <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
      <Activity className="size-6" strokeWidth={2} aria-hidden="true" />
    </span>
    <span className="text-xl font-extrabold tracking-[-0.06em]">ACTIV<span className="text-primary">ANT</span></span>
  </Link>;
}
