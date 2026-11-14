import { XMLParser } from "fast-xml-parser";
import { cached, fetchText } from "../cache";
import { FEEDS, NEWS_MAX_AGE_MS, NEWS_MAX_ITEMS, NEWS_TTL_MS, type FeedConfig } from "../config";
import { scoreHeadline } from "../news-score";
import type { NewsItem, NewsResponse, SourceAttempt } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

type Node = Record<string, unknown>;

function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && "#text" in (v as Node)) return text((v as Node)["#text"]);
  return "";
}

function list(v: unknown): Node[] {
  if (Array.isArray(v)) return v as Node[];
  return v && typeof v === "object" ? [v as Node] : [];
}

function linkOf(v: unknown): string {
  if (typeof v === "string") return v;
  const links = list(v);
  const alt = links.find((l) => l["@_rel"] === "alternate") ?? links[0];
  return alt ? text(alt["@_href"]) || text(alt) : "";
}

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function loadFeed(feed: FeedConfig): Promise<NewsItem[]> {
  const xml = await fetchText(
    feed.url,
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; xau-sentinel/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" } },
    7000,
  );
  const doc = parser.parse(xml) as Node;
  const rss = doc.rss as Node | undefined;
  const channel = (rss?.channel ?? (doc["rdf:RDF"] as Node | undefined)) as Node | undefined;
  const atom = doc.feed as Node | undefined;
  const rawItems = channel ? list(channel.item ?? (doc["rdf:RDF"] as Node | undefined)?.item) : atom ? list(atom.entry) : [];
  if (!channel && !atom) throw new Error("Bukan RSS atau Atom");

  const items: NewsItem[] = [];
  for (const it of rawItems) {
    let title = clean(text(it.title));
    const link = linkOf(it.link) || text(it.guid);
    const when = Date.parse(text(it.pubDate) || text(it.published) || text(it.updated) || text(it["dc:date"]));
    if (!title || !link || !Number.isFinite(when)) continue;

    // Google News menaruh nama penerbit di <source> dan di akhir judul.
    let source = clean(text(it.source));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    if (!source) source = feed.name;

    const scored = scoreHeadline(title);
    if (!feed.focused && scored.tags.length === 0) continue;

    items.push({
      id: hash(link),
      title,
      link,
      source,
      feed: feed.name,
      publishedAt: when,
      score: scored.score,
      tags: scored.tags,
      urgent: scored.urgent,
    });
  }
  return items;
}

async function loadAll(): Promise<{ items: NewsItem[]; attempts: SourceAttempt[] }> {
  const results = await Promise.allSettled(FEEDS.map(loadFeed));
  const attempts: SourceAttempt[] = [];
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  const now = Date.now();

  results.forEach((r, i) => {
    const name = FEEDS[i].name;
    if (r.status === "rejected") {
      attempts.push({ name, ok: false, detail: String(r.reason?.message ?? r.reason) });
      return;
    }
    let kept = 0;
    for (const it of r.value) {
      const age = now - it.publishedAt;
      if (age > NEWS_MAX_AGE_MS || age < -10 * 60_000) continue;
      const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
      kept++;
    }
    attempts.push({
      name,
      ok: true,
      detail: kept > 0 ? `${kept} judul relevan` : "Terhubung, tidak ada judul relevan dalam 36 jam terakhir",
    });
  });

  if (results.every((r) => r.status === "rejected")) {
    throw new Error("Semua feed berita gagal diakses");
  }

  items.sort((a, b) => b.publishedAt - a.publishedAt);
  return { items: items.slice(0, NEWS_MAX_ITEMS), attempts };
}

export async function getNews(): Promise<NewsResponse> {
  try {
    const res = await cached("news", NEWS_TTL_MS, loadAll);
    return { ...res.value, fetchedAt: Date.now() };
  } catch (err) {
    return {
      items: [],
      attempts: FEEDS.map((f) => ({ name: f.name, ok: false, detail: err instanceof Error ? err.message : String(err) })),
      fetchedAt: Date.now(),
    };
  }
}
