import { Elysia } from 'elysia';
import { 
  checkScraperHealth,
  syncEvents,
  syncNews,
  syncAll,
  getSyncStats
} from '../controllers/syncController';

export const syncDebugRoutes = new Elysia({ prefix: '/api/debug' })
  
  /**
   * GET /api/debug/scraper-health - Verifica el estado de salud del scraper
   */
  .get('/scraper-health', async () => {
    console.log('🔍 Debug health endpoint called');
    const result = await checkScraperHealth();
    console.log('🔍 Debug health result:', result);
    return result;
  })
  
  /**
   * GET /api/debug/sync-stats - Obtiene estadísticas de sincronización
   */
  .get('/sync-stats', async () => {
    console.log('🔍 Debug stats endpoint called');
    const result = await getSyncStats();
    console.log('🔍 Debug stats result:', result.success ? 'Success' : 'Failed');
    return result;
  })
  
  /**
   * POST /api/debug/sync-events - Sincroniza solo eventos
   */
  .post('/sync-events', async () => {
    console.log('🔍 Debug events endpoint called');
    try {
      const result = await syncEvents();
      console.log('🔍 Debug events result:', {
        success: result.success,
        usabmx: result.data?.usabmx,
        uci: result.data?.uci,
        errors: result.data?.errors?.length || 0
      });
      return result;
    } catch (error) {
      console.error('🔍 Debug events error:', error);
      throw error;
    }
  })
  
  /**
   * POST /api/debug/sync-news - Sincroniza solo noticias
   */
  .post('/sync-news', async () => {
    console.log('🔍 Debug news endpoint called');
    try {
      const result = await syncNews();
      console.log('🔍 Debug news result:', {
        success: result.success,
        usabmx: result.data?.usabmx,
        uci: result.data?.uci,
        errors: result.data?.errors?.length || 0
      });
      return result;
    } catch (error) {
      console.error('🔍 Debug news error:', error);
      throw error;
    }
  });
