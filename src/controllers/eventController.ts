import { normalizeEvent } from "../utils/normalizers.js";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || "http://localhost:4000";

async function fetchScraper(path: string) {
  const url = `${SCRAPER_API_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scraper API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getEvents() {
  try {
    const data = await fetchScraper("/events");
    const arr = Array.isArray(data)
      ? data
      : data?.events ?? data?.items ?? data?.data ?? []; // fallback seguro
    const normalized = arr.map(normalizeEvent);
    return { total: normalized.length, events: normalized };
  } catch (err) {
    console.error("getEvents error:", err);
    return { total: 0, events: [] }; // nunca undefined
  }
}
