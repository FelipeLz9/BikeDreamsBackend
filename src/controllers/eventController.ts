import { normalizeEvent } from "../utils/normalizers";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SCRAPER_API_URL = process.env.SCRAPER_API_URL || "http://localhost:4000";

async function fetchScraper(path: string) {
  const url = `${SCRAPER_API_URL}${path}`;
  console.log(`🔄 Fetching: ${url}`);
  
  try {
    const res = await fetch(url, { 
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Scraper API error ${res.status}: ${text}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error(`❌ Error fetching ${url}:`, error);
    throw error;
  }
}

async function fetchEventSource(endpoint: string, sourceName: string) {
  try {
    const data = await fetchScraper(endpoint);
    const events = Array.isArray(data)
      ? data
      : data?.events ?? data?.items ?? data?.data ?? [];
    
    console.log(`✅ ${sourceName}: ${events.length} eventos obtenidos`);
    return events;
  } catch (error) {
    console.error(`❌ Error fetching ${sourceName} events:`, error);
    return []; // Return empty array on error
  }
}

export async function getEvents(filter?: 'upcoming' | 'past') {
  try {
    console.log(`🚀 Fetching events from scraper API (filter: ${filter || 'all'})`);
    
    // Use scraper API directly (skip database for now)
    console.log('📡 Fetching events from scraper API');
    
    const usabmxEndpoint = filter 
      ? `/events/usabmx/${filter}`
      : '/events/usabmx/';
    const uciEndpoint = filter 
      ? `/events/uci/${filter}`
      : '/events/uci/';
    
    const [usabmxEvents, uciEvents] = await Promise.all([
      fetchEventSource(usabmxEndpoint, 'USABMX'),
      fetchEventSource(uciEndpoint, 'UCI')
    ]);
    
    const allEvents = [...usabmxEvents, ...uciEvents];
    const normalized = allEvents.map(normalizeEvent);
    normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`📊 Total events from API: ${normalized.length} (USABMX: ${usabmxEvents.length}, UCI: ${uciEvents.length})`);
    
    return { 
      total: normalized.length, 
      events: normalized,
      sources: { usabmx: usabmxEvents.length, uci: uciEvents.length },
      dataSource: 'scraper-api'
    };
    
  } catch (err) {
    console.error("❌ getEvents error:", err);
    return { 
      total: 0, 
      events: [],
      sources: { usabmx: 0, uci: 0 },
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

export async function getUpcomingEvents() {
  return getEvents('upcoming');
}

export async function getPastEvents() {
  return getEvents('past');
}
