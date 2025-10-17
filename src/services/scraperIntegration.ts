import { PrismaClient, EventSource, NewsSource } from '@prisma/client';

const prisma = new PrismaClient();

// URL de la API del scraper
const SCRAPER_API_URL = process.env.SCRAPER_API_URL || 'http://localhost:4000';

// Interfaces para los datos del scraper
interface ScraperEvent {
  title: string;
  start_date?: string;
  end_date?: string;
  date?: string;
  location: string;
  city?: string;
  state?: string;
  country?: string;
  continent?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  details_url?: string;
  is_uci_event?: boolean;
  dates?: string;
}

interface ScraperNews {
  id: number | string;
  title: string;
  published_at?: string;
  date?: string;
  category?: string;
  url?: string;
  summary?: string;
  author?: string;
}

class ScraperIntegrationService {
  
  /**
   * Obtiene eventos desde la API del scraper
   */
  async fetchEventsFromScraper(): Promise<{ usabmx: ScraperEvent[], uci: ScraperEvent[] }> {
    try {
      console.log('🔄 Obteniendo eventos desde el scraper...');
      
      const [usabmxResponse, uciResponse] = await Promise.all([
        fetch(`${SCRAPER_API_URL}/events/usabmx/`).catch(e => ({ ok: false, error: e } as any)),
        fetch(`${SCRAPER_API_URL}/events/uci/`).catch(e => ({ ok: false, error: e } as any))
      ]);

      // El API devuelve { total: number, events: Event[] }
      let usabmxData = null;
      let uciData = null;

      if (usabmxResponse.ok) {
        try {
          usabmxData = await (usabmxResponse as Response).json();
        } catch (e) {
          console.error('❌ Error parsing USABMX response:', e);
        }
      } else {
        console.error('❌ USABMX request failed:', (usabmxResponse as any).status || (usabmxResponse as any).error);
      }

      if (uciResponse.ok) {
        try {
          uciData = await (uciResponse as Response).json();
        } catch (e) {
          console.error('❌ Error parsing UCI response:', e);
        }
      } else {
        console.error('❌ UCI request failed:', (uciResponse as any).status || (uciResponse as any).error);
      }

      const usabmx = Array.isArray(usabmxData?.events) ? usabmxData.events : [];
      const uci = Array.isArray(uciData?.events) ? uciData.events : [];

      console.log(`✅ Eventos obtenidos: ${usabmx.length} USABMX, ${uci.length} UCI`);
      
      return { usabmx, uci };
    } catch (error) {
      console.error('❌ Error obteniendo eventos del scraper:', error);
      return { usabmx: [], uci: [] };
    }
  }

  /**
   * Obtiene noticias desde la API del scraper
   */
  async fetchNewsFromScraper(): Promise<{ usabmx: ScraperNews[], uci: ScraperNews[] }> {
    try {
      console.log('🔄 Obteniendo noticias desde el scraper...');
      
      const [usabmxResponse, uciResponse] = await Promise.all([
        fetch(`${SCRAPER_API_URL}/news/`).catch(e => ({ ok: false, error: e } as any)), // Endpoint general para noticias
        fetch(`${SCRAPER_API_URL}/news/uci/`).catch(e => ({ ok: false, error: e } as any)) // Endpoint específico para noticias UCI
      ]);

      // El API devuelve { total: number, news: News[] }
      let usabmxData = null;
      let uciData = null;

      if (usabmxResponse.ok) {
        try {
          usabmxData = await (usabmxResponse as Response).json();
        } catch (e) {
          console.error('❌ Error parsing USABMX news response:', e);
        }
      } else {
        console.error('❌ USABMX news request failed:', (usabmxResponse as any).status || (usabmxResponse as any).error);
      }

      if (uciResponse.ok) {
        try {
          uciData = await (uciResponse as Response).json();
        } catch (e) {
          console.error('❌ Error parsing UCI news response:', e);
        }
      } else {
        console.error('❌ UCI news request failed:', (uciResponse as any).status || (uciResponse as any).error);
      }

      const usabmx = Array.isArray(usabmxData?.news) ? usabmxData.news : [];
      const uci = Array.isArray(uciData?.news) ? uciData.news : [];

      console.log(`✅ Noticias obtenidas: ${usabmx.length} USABMX, ${uci.length} UCI`);
      
      return { usabmx, uci };
    } catch (error) {
      console.error('❌ Error obteniendo noticias del scraper:', error);
      return { usabmx: [], uci: [] };
    }
  }

  /**
   * Mapea un evento del scraper al formato de la base de datos
   */
  private mapEventData(scraperEvent: ScraperEvent, source: EventSource) {
    // Determinar la fecha principal
    const mainDate = scraperEvent.start_date || scraperEvent.date || new Date().toISOString();
    
    return {
      // Campos básicos (retrocompatibilidad)
      name: scraperEvent.title,
      date: new Date(mainDate),
      location: scraperEvent.location || 'Por definir',
      
      // Campos expandidos del scraper
      title: scraperEvent.title,
      start_date: scraperEvent.start_date ? new Date(scraperEvent.start_date) : null,
      end_date: scraperEvent.end_date ? new Date(scraperEvent.end_date) : null,
      city: scraperEvent.city,
      state: scraperEvent.state,
      country: scraperEvent.country,
      continent: scraperEvent.continent,
      latitude: scraperEvent.latitude ? String(scraperEvent.latitude) : null,
      longitude: scraperEvent.longitude ? String(scraperEvent.longitude) : null,
      
      // Metadatos
      source,
      details_url: scraperEvent.details_url,
      is_uci_event: scraperEvent.is_uci_event || source === 'UCI',
      dates_text: scraperEvent.dates,
      
      // ID para sincronización (basado en título + fecha + source)
      scraper_id: `${source}_${scraperEvent.title}_${mainDate}`.replace(/\s+/g, '_').toLowerCase()
    };
  }

  /**
   * Mapea una noticia del scraper al formato de la base de datos
   */
  private mapNewsData(scraperNews: ScraperNews, source: NewsSource) {
    const mainDate = scraperNews.published_at || scraperNews.date || new Date().toISOString();
    
    return {
      // Campos básicos (retrocompatibilidad)
      title: scraperNews.title,
      content: scraperNews.summary || scraperNews.title, // Fallback al título si no hay summary
      
      // Campos expandidos del scraper
      published_at: scraperNews.published_at ? new Date(scraperNews.published_at) : null,
      date: scraperNews.date ? new Date(scraperNews.date) : null,
      category: scraperNews.category,
      url: scraperNews.url,
      summary: scraperNews.summary,
      author: scraperNews.author,
      
      // Metadatos
      source,
      
      // IDs para sincronización
      scraper_id: `${source}_${scraperNews.id}`,
      external_id: typeof scraperNews.id === 'number' ? String(scraperNews.id) : null,
      uuid_id: typeof scraperNews.id === 'string' ? scraperNews.id : null
    };
  }

  /**
   * Sincroniza eventos desde el scraper a la base de datos
   */
  async syncEvents(): Promise<{ success: boolean, usabmx: number, uci: number, errors: string[] }> {
    const errors: string[] = [];
    let usabmxCount = 0;
    let uciCount = 0;

    try {
      const { usabmx, uci } = await this.fetchEventsFromScraper();

      // Validar que los datos sean arrays
      if (!Array.isArray(usabmx) || !Array.isArray(uci)) {
        throw new Error(`Invalid data format: usabmx is ${typeof usabmx}, uci is ${typeof uci}`);
      }

      // Sincronizar eventos USABMX
      for (const scraperEvent of usabmx) {
        try {
          const eventData = this.mapEventData(scraperEvent, EventSource.USABMX);
          
          await prisma.event.upsert({
            where: { scraper_id: eventData.scraper_id },
            create: eventData,
            update: eventData
          });
          
          usabmxCount++;
        } catch (error) {
          errors.push(`Error sincronizando evento USABMX "${scraperEvent.title}": ${error}`);
        }
      }

      // Sincronizar eventos UCI
      for (const scraperEvent of uci) {
        try {
          const eventData = this.mapEventData(scraperEvent, EventSource.UCI);
          
          await prisma.event.upsert({
            where: { scraper_id: eventData.scraper_id },
            create: eventData,
            update: eventData
          });
          
          uciCount++;
        } catch (error) {
          errors.push(`Error sincronizando evento UCI "${scraperEvent.title}": ${error}`);
        }
      }

      console.log(`✅ Eventos sincronizados: ${usabmxCount} USABMX, ${uciCount} UCI`);
      
      return { success: true, usabmx: usabmxCount, uci: uciCount, errors };
      
    } catch (error) {
      const errorMsg = `Error general sincronizando eventos: ${error}`;
      errors.push(errorMsg);
      console.error('❌', errorMsg);
      
      return { success: false, usabmx: usabmxCount, uci: uciCount, errors };
    }
  }

  /**
   * Sincroniza noticias desde el scraper a la base de datos
   */
  async syncNews(): Promise<{ success: boolean, usabmx: number, uci: number, errors: string[] }> {
    const errors: string[] = [];
    let usabmxCount = 0;
    let uciCount = 0;

    try {
      const { usabmx, uci } = await this.fetchNewsFromScraper();

      // Validar que los datos sean arrays
      if (!Array.isArray(usabmx) || !Array.isArray(uci)) {
        throw new Error(`Invalid news data format: usabmx is ${typeof usabmx}, uci is ${typeof uci}`);
      }

      // Sincronizar noticias USABMX
      for (const scraperNews of usabmx) {
        try {
          const newsData = this.mapNewsData(scraperNews, NewsSource.USABMX);
          
          await prisma.news.upsert({
            where: { scraper_id: newsData.scraper_id },
            create: newsData,
            update: newsData
          });
          
          usabmxCount++;
        } catch (error) {
          errors.push(`Error sincronizando noticia USABMX "${scraperNews.title}": ${error}`);
        }
      }

      // Sincronizar noticias UCI
      for (const scraperNews of uci) {
        try {
          const newsData = this.mapNewsData(scraperNews, NewsSource.UCI);
          
          await prisma.news.upsert({
            where: { scraper_id: newsData.scraper_id },
            create: newsData,
            update: newsData
          });
          
          uciCount++;
        } catch (error) {
          errors.push(`Error sincronizando noticia UCI "${scraperNews.title}": ${error}`);
        }
      }

      console.log(`✅ Noticias sincronizadas: ${usabmxCount} USABMX, ${uciCount} UCI`);
      
      return { success: true, usabmx: usabmxCount, uci: uciCount, errors };
      
    } catch (error) {
      const errorMsg = `Error general sincronizando noticias: ${error}`;
      errors.push(errorMsg);
      console.error('❌', errorMsg);
      
      return { success: false, usabmx: usabmxCount, uci: uciCount, errors };
    }
  }

  /**
   * Sincroniza tanto eventos como noticias
   */
  async syncAll(): Promise<{
    success: boolean,
    events: { usabmx: number, uci: number },
    news: { usabmx: number, uci: number },
    errors: string[]
  }> {
    console.log('🚀 Iniciando sincronización completa con scraper...');
    
    const [eventsResult, newsResult] = await Promise.all([
      this.syncEvents(),
      this.syncNews()
    ]);

    const allErrors = [...eventsResult.errors, ...newsResult.errors];
    const success = eventsResult.success && newsResult.success && allErrors.length === 0;

    console.log('📊 Sincronización completa finalizada:', {
      success,
      events: { usabmx: eventsResult.usabmx, uci: eventsResult.uci },
      news: { usabmx: newsResult.usabmx, uci: newsResult.uci },
      totalErrors: allErrors.length
    });

    return {
      success,
      events: { usabmx: eventsResult.usabmx, uci: eventsResult.uci },
      news: { usabmx: newsResult.usabmx, uci: newsResult.uci },
      errors: allErrors
    };
  }

  /**
   * Verifica conectividad con la API del scraper
   */
  async checkScraperHealth(): Promise<{ isHealthy: boolean, scraperUrl: string, error?: string }> {
    try {
      const response = await fetch(`${SCRAPER_API_URL}/`, { signal: AbortSignal.timeout(5000) });
      return {
        isHealthy: response.ok,
        scraperUrl: SCRAPER_API_URL
      };
    } catch (error) {
      return {
        isHealthy: false,
        scraperUrl: SCRAPER_API_URL,
        error: String(error)
      };
    }
  }
}

export const scraperIntegrationService = new ScraperIntegrationService();
