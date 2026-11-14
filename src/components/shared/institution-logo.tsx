import Image from "next/image";
import institutionLogo from "../../../public/images/Logo Gobernacion.png";

export function InstitutionLogo() {
  return <Image
    src={institutionLogo}
    alt="Gobernación de Antioquia, República de Colombia"
    sizes="(min-width: 640px) 160px, 144px"
    className="h-auto w-36 max-w-full object-contain sm:w-40"
  />;
}
