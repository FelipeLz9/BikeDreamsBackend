import { normalizeNews } from "../utils/normalizers";
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

async function fetchNewsSource(endpoint: string, sourceName: string) {
  try {
    const data = await fetchScraper(endpoint);
    const news = Array.isArray(data)
      ? data
      : data?.news ?? data?.items ?? data?.data ?? [];
    
    console.log(`✅ ${sourceName}: ${news.length} noticias obtenidas`);
    return news;
  } catch (error) {
    console.error(`❌ Error fetching ${sourceName} news:`, error);
    return []; // Return empty array on error
  }
}

export async function getNews() {
  try {
    console.log('🚀 Fetching news from scraper API');
    
    // Use scraper API directly (skip database for now)
    console.log('📡 Fetching news from scraper API');
    
    const [usabmxNews, uciNews] = await Promise.all([
      fetchNewsSource('/news/usabmx/', 'USABMX'),
      fetchNewsSource('/news/uci/', 'UCI')
    ]);
    
    const allNews = [...usabmxNews, ...uciNews];
    const normalized = allNews.map(normalizeNews);
    normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`📊 Total news from API: ${normalized.length} (USABMX: ${usabmxNews.length}, UCI: ${uciNews.length})`);
    
    return { 
      total: normalized.length, 
      news: normalized,
      sources: { usabmx: usabmxNews.length, uci: uciNews.length },
      dataSource: 'scraper-api'
    };
    
  } catch (err) {
    console.error('❌ getNews error:', err);
    return { 
      total: 0, 
      news: [],
      sources: { usabmx: 0, uci: 0 },
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

export async function getNewsById(id: string) {
  try {
    console.log(`🔍 Searching for news with ID: ${id}`);
    
    // Try USABMX first, then UCI
    const sources = [
      { endpoint: `/news/usabmx/id/${id}`, name: 'USABMX' },
      { endpoint: `/news/uci/id/${id}`, name: 'UCI' }
    ];
    
    for (const source of sources) {
      try {
        const data = await fetchScraper(source.endpoint);
        
        // If we get a single item (not an array), return it normalized
        if (data && !data.error && (data.id || data.title)) {
          console.log(`✅ Found news in ${source.name}`);
          return normalizeNews(data);
        }
        
        // If we get an array with items, return the first one
        if (Array.isArray(data) && data.length > 0) {
          console.log(`✅ Found news in ${source.name} (from array)`);
          return normalizeNews(data[0]);
        }
      } catch (error) {
        console.log(`⚠️ News not found in ${source.name}`);
        continue; // Try next source
      }
    }
    
    // If not found in any source
    console.log(`❌ News with ID ${id} not found in any source`);
    return null;
  } catch (err) {
    console.error('❌ getNewsById error:', err);
    return null;
  }
}
