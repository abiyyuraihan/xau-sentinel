import { connection, type NextRequest } from "next/server";
import { INTERVALS } from "@/lib/config";
import { getMarket } from "@/lib/providers/market";
import type { Interval } from "@/lib/types";

export async function GET(request: NextRequest) {
  await connection();
  const raw = request.nextUrl.searchParams.get("interval") ?? "15min";
  const interval = (INTERVALS.find((i) => i.id === raw)?.id ?? "15min") as Interval;
  const data = await getMarket(interval);
  return Response.json(data, {
    // CDN Vercel menahan respons sebentar supaya kuota API tidak habis.
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
