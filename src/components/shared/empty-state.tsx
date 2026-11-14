import type { LucideIcon } from "lucide-react";

type EmptyStateProps = { icon: LucideIcon; title: string; description: string };

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return <div className="flex flex-col items-center px-6 py-10 text-center">
    <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
      <Icon className="size-6" aria-hidden="true" />
    </span>
    <h3 className="text-lg font-semibold">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>;
}
