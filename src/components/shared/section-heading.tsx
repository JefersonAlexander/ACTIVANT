type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  id: string;
};

export function SectionHeading({ eyebrow, title, description, id }: SectionHeadingProps) {
  return <div className="max-w-2xl space-y-3">
    <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
    <h2 id={id} className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{title}</h2>
    {description && <p className="leading-relaxed text-muted-foreground">{description}</p>}
  </div>;
}
