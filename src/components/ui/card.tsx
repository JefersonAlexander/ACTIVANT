import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-2xl border border-white/80 bg-card text-card-foreground shadow-soft", className)} {...props} />;
}
function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("space-y-2 p-6", className)} {...props} />;
}
function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-lg leading-snug font-semibold tracking-tight", className)} {...props} />;
}
function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}
function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6 pb-6", className)} {...props} />;
}
export { Card, CardHeader, CardTitle, CardDescription, CardContent };
