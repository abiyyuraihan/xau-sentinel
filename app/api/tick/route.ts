import { connection } from "next/server";
import { getTick } from "@/lib/providers/tick";

export async function GET() {
  await connection();
  const data = await getTick();
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=1, stale-while-revalidate=2" },
  });
}
