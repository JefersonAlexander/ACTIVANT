import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs leading-5 font-medium", {
  variants: { variant: {
    default: "border-primary/20 bg-secondary text-secondary-foreground",
    outline: "border-border bg-background text-muted-foreground",
  } },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
