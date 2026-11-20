import Image from "next/image";
import clsx from "clsx";

/**
 * Logo de Vitro Hogar. Hay dos archivos: el normal (letras oscuras, para fondo claro) y el de modo noche
 * (letras blancas, fondo transparente). Se muestra uno u otro según el tema (ver .logo-claro / .logo-noche en globals.css).
 */
export function Logo({ alt, className }: { alt: string; className?: string }) {
  return (
    <>
      <Image src="/logo-vitrohogar.png" alt={alt} width={900} height={176} priority className={clsx("logo-claro", className)} />
      <Image src="/logo-vitrohogar-noche.png" alt={alt} width={900} height={176} priority className={clsx("logo-noche", className)} />
    </>
  );
}
