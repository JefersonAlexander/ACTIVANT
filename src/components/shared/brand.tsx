import Link from "next/link";
import Image from "next/image";
import activantLogo from "../../../public/images/Logotipo Activant.png";
import { cn } from "@/lib/utils";

type BrandProps = { className?: string; href?: string; ariaLabel?: string; preload?: boolean };

export function Brand({ className, href = "/", ariaLabel = "ACTIVANT, ir al inicio", preload = false }: BrandProps) {
  return <Link href={href} aria-label={ariaLabel} className={cn("inline-flex min-h-11 max-w-full shrink-0 items-center rounded-md", className)}>
    <Image src={activantLogo} alt="ACTIVANT" sizes="(min-width: 640px) 160px, 144px" preload={preload} className="h-auto w-36 object-contain sm:w-40" />
  </Link>;
}
