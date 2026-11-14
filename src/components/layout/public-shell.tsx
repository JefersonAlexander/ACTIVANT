import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
export function PublicShell({ children }: { children: React.ReactNode }) {
  return <><SiteHeader /><main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main><SiteFooter /></>;
}
