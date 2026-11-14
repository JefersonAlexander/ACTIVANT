import { LibraryCatalog } from "@/modules/library/components/catalog";
import { categorySchema } from "@/modules/library/contracts";
import { pageNumber, type SearchParams } from "@/modules/administration/contracts";
export const metadata = { title: "Biblioteca de bienestar" };
export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params=await searchParams;const category=categorySchema.safeParse(params.categoria);
  return <LibraryCatalog category={category.success?category.data:undefined} search={typeof params.buscar==="string"?params.buscar.slice(0,100):""} page={pageNumber(params.pagina)}/>;
}
