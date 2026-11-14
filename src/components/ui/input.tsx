import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn(
    "flex h-12 w-full min-w-0 rounded-full border border-input bg-card px-4 py-2 text-base text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:outline-destructive",
    className,
  )} {...props} />;
}
