import { Elysia } from 'elysia';
import { 
  checkScraperHealth,
  syncEvents,
  syncNews,
  syncAll,
  getSyncStats
} from '../controllers/syncController';
import { authMiddleware } from '../middleware/auth';

export const syncRoutes = new Elysia({ prefix: '/api/sync' })
  .use(authMiddleware) // Requiere autenticación
  
  /**
   * GET /sync/health - Verifica el estado de salud del scraper
   */
  .get('/health', async () => {
    const result = await checkScraperHealth();
    return result;
  })
  
  /**
   * GET /sync/stats - Obtiene estadísticas de sincronización
   */
  .get('/stats', async () => {
    const result = await getSyncStats();
    return result;
  })
  
  /**
   * POST /sync/events - Sincroniza solo eventos
   */
  .post('/events', async () => {
    const result = await syncEvents();
    return result;
  })
  
  /**
   * POST /sync/news - Sincroniza solo noticias
   */
  .post('/news', async () => {
    const result = await syncNews();
    return result;
  })
  
  /**
   * POST /sync/all - Sincroniza tanto eventos como noticias
   */
  .post('/all', async () => {
    const result = await syncAll();
    return result;
  });
