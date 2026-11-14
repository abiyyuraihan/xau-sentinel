import { connection } from "next/server";
import { getCalendar } from "@/lib/providers/calendar";

export async function GET() {
  await connection();
  const data = await getCalendar();
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
  });
}
