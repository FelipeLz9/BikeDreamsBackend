import { scraperIntegrationService } from '../services/scraperIntegration.js';
import { syncManagerService } from '../services/syncManager.js';

/**
 * Verifica el estado de salud del scraper
 */
export async function checkScraperHealth() {
  try {
    const healthCheck = await scraperIntegrationService.checkScraperHealth();
    return {
      success: true,
      data: healthCheck
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        isHealthy: false,
        scraperUrl: process.env.SCRAPER_API_URL || 'http://localhost:4000',
        error: String(error)
      }
    };
  }
}

/**
 * Sincroniza solo eventos desde el scraper
 */
export async function syncEvents() {
  try {
    console.log('🚀 Starting events synchronization...');
    const result = await scraperIntegrationService.syncEvents();
    
    return {
      success: result.success,
      data: {
        usabmx: result.usabmx,
        uci: result.uci,
        total: result.usabmx + result.uci,
        errors: result.errors
      },
      message: result.success 
        ? `Successfully synchronized ${result.usabmx + result.uci} events`
        : `Synchronization completed with ${result.errors.length} errors`
    };
  } catch (error) {
    console.error('❌ Error in syncEvents controller:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { usabmx: 0, uci: 0, total: 0, errors: [String(error)] }
    };
  }
}

/**
 * Sincroniza solo noticias desde el scraper
 */
export async function syncNews() {
  try {
    console.log('🚀 Starting news synchronization...');
    const result = await scraperIntegrationService.syncNews();
    
    return {
      success: result.success,
      data: {
        usabmx: result.usabmx,
        uci: result.uci,
        total: result.usabmx + result.uci,
        errors: result.errors
      },
      message: result.success 
        ? `Successfully synchronized ${result.usabmx + result.uci} news articles`
        : `Synchronization completed with ${result.errors.length} errors`
    };
  } catch (error) {
    console.error('❌ Error in syncNews controller:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { usabmx: 0, uci: 0, total: 0, errors: [String(error)] }
    };
  }
}

/**
 * Sincroniza tanto eventos como noticias desde el scraper
 */
export async function syncAll() {
  try {
    console.log('🚀 Starting full synchronization...');
    const result = await scraperIntegrationService.syncAll();
    
    return {
      success: result.success,
      data: {
        events: {
          usabmx: result.events.usabmx,
          uci: result.events.uci,
          total: result.events.usabmx + result.events.uci
        },
        news: {
          usabmx: result.news.usabmx,
          uci: result.news.uci,
          total: result.news.usabmx + result.news.uci
        },
        totalSynced: result.events.usabmx + result.events.uci + result.news.usabmx + result.news.uci,
        errors: result.errors
      },
      message: result.success 
        ? `Successfully synchronized ${result.events.usabmx + result.events.uci} events and ${result.news.usabmx + result.news.uci} news articles`
        : `Synchronization completed with ${result.errors.length} errors`
    };
  } catch (error) {
    console.error('❌ Error in syncAll controller:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        events: { usabmx: 0, uci: 0, total: 0 },
        news: { usabmx: 0, uci: 0, total: 0 },
        totalSynced: 0,
        errors: [String(error)]
      }
    };
  }
}

/**
 * Obtiene estadísticas de sincronización de la base de datos
 */
export async function getSyncStats() {
  try {
    console.log('📊 Getting sync statistics...');
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const [
      totalEvents,
      usabmxEvents,
      uciEvents,
      totalNews,
      usabmxNews,
      uciNews,
      eventsWithCoords,
      recentEvents,
      recentNews
    ] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({ where: { source: 'USABMX' } }),
      prisma.event.count({ where: { source: 'UCI' } }),
      prisma.news.count(),
      prisma.news.count({ where: { source: 'USABMX' } }),
      prisma.news.count({ where: { source: 'UCI' } }),
      prisma.event.count({ 
        where: { 
          AND: [
            { latitude: { not: null } },
            { longitude: { not: null } }
          ]
        }
      }),
      prisma.event.count({
        where: {
          date: { gte: new Date() }
        }
      }),
      prisma.news.count({
        where: {
          published_at: { 
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    await prisma.$disconnect();
    
    return {
      success: true,
      data: {
        events: {
          total: totalEvents,
          usabmx: usabmxEvents,
          uci: uciEvents,
          withCoordinates: eventsWithCoords,
          upcoming: recentEvents
        },
        news: {
          total: totalNews,
          usabmx: usabmxNews,
          uci: uciNews,
          recentMonth: recentNews
        },
        lastUpdated: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ Error in getSyncStats controller:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        events: { total: 0, usabmx: 0, uci: 0, withCoordinates: 0, upcoming: 0 },
        news: { total: 0, usabmx: 0, uci: 0, recentMonth: 0 },
        lastUpdated: new Date().toISOString()
      }
    };
  }
}
