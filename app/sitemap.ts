import type { MetadataRoute } from "next";
import { PERMITRAIL_CITIES, PERMITRAIL_TRADES } from "@/lib/permitrail-core";

function origin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://pennyrail.vercel.app";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = origin();
  const now = new Date();
  return [
    { url: `${base}/permitrail`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 },
    ...PERMITRAIL_CITIES.flatMap(city => PERMITRAIL_TRADES.map(trade => ({ url: `${base}/permitrail/market/${city}/${trade}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 }))),
  ];
}
