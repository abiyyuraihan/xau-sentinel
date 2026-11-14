import { connection } from "next/server";
import { getNews } from "@/lib/providers/news";

export async function GET() {
  await connection();
  const data = await getNews();
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90" },
  });
}
