import { Elysia } from 'elysia';
import { 
  getOptimizedEvents, 
  getEventStats, 
  searchEventsAutocomplete 
} from '../controllers/optimizedEventController';

export const optimizedEventRoutes = new Elysia({ prefix: '/api/v2/events' })

  /**
   * GET /api/v2/events - Obtiene eventos con paginación avanzada y filtros
   * 
   * Query parameters:
   * - page: número de página (default: 1)
   * - limit: elementos por página (default: 20, max: 100)
   * - search: término de búsqueda en título, ubicación, ciudad, país
   * - source: 'USABMX' | 'UCI' | 'both' (default: 'both')
   * - timeFilter: 'upcoming' | 'past' | 'all' (default: 'all')
   * - country: filtrar por país específico
   * - continent: filtrar por continente específico
   * - startDate: fecha inicial (ISO string)
   * - endDate: fecha final (ISO string)
   * - hasCoordinates: true | false - filtrar eventos con/sin coordenadas
   * - sortBy: 'date' | 'title' | 'location' | 'created_at' (default: 'date')
   * - sortOrder: 'asc' | 'desc' (default: 'desc')
   */
  .get('/', async ({ query }) => {
    const {
      page,
      limit,
      search,
      source,
      timeFilter,
      country,
      continent,
      startDate,
      endDate,
      hasCoordinates,
      sortBy,
      sortOrder
    } = query as {
      page?: string;
      limit?: string;
      search?: string;
      source?: 'USABMX' | 'UCI' | 'both';
      timeFilter?: 'upcoming' | 'past' | 'all';
      country?: string;
      continent?: string;
      startDate?: string;
      endDate?: string;
      hasCoordinates?: string;
      sortBy?: 'date' | 'title' | 'location' | 'created_at';
      sortOrder?: 'asc' | 'desc';
    };

    const filters = {
      search: search?.trim(),
      source,
      timeFilter,
      country: country?.trim(),
      continent: continent?.trim(),
      startDate,
      endDate,
      hasCoordinates: hasCoordinates === 'true' ? true : hasCoordinates === 'false' ? false : undefined
    };

    const pagination = {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      sortBy,
      sortOrder
    };

    return await getOptimizedEvents(filters, pagination);
  })

  /**
   * GET /api/v2/events/stats - Estadísticas rápidas de eventos
   */
  .get('/stats', async () => {
    return await getEventStats();
  })

  /**
   * GET /api/v2/events/search/autocomplete - Búsqueda con autocompletado
   * 
   * Query parameters:
   * - q: término de búsqueda (mínimo 2 caracteres)
   * - limit: máximo resultados (default: 10, max: 25)
   */
  .get('/search/autocomplete', async ({ query }) => {
    const { q, limit } = query as { q?: string; limit?: string };
    
    if (!q || q.length < 2) {
      return {
        success: false,
        message: 'Query debe tener al menos 2 caracteres',
        data: []
      };
    }

    const maxLimit = Math.min(25, limit ? parseInt(limit) : 10);
    return await searchEventsAutocomplete(q, maxLimit);
  })

  /**
   * GET /api/v2/events/upcoming - Eventos próximos (optimizado)
   */
  .get('/upcoming', async ({ query }) => {
    const { limit, page } = query as { limit?: string; page?: string };
    
    return await getOptimizedEvents(
      { timeFilter: 'upcoming' },
      { 
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        sortBy: 'date',
        sortOrder: 'asc' // Próximos primero
      }
    );
  })

  /**
   * GET /api/v2/events/past - Eventos pasados (optimizado)
   */
  .get('/past', async ({ query }) => {
    const { limit, page } = query as { limit?: string; page?: string };
    
    return await getOptimizedEvents(
      { timeFilter: 'past' },
      { 
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        sortBy: 'date',
        sortOrder: 'desc' // Más recientes primero
      }
    );
  })

  /**
   * GET /api/v2/events/by-source/:source - Eventos por fuente específica
   */
  .get('/by-source/:source', async ({ params, query }) => {
    const { source } = params as { source: 'usabmx' | 'uci' };
    const { limit, page, search } = query as { limit?: string; page?: string; search?: string };
    
    const sourceMap = {
      'usabmx': 'USABMX' as const,
      'uci': 'UCI' as const
    };

    const mappedSource = sourceMap[source.toLowerCase() as keyof typeof sourceMap];
    
    if (!mappedSource) {
      return {
        success: false,
        message: 'Fuente inválida. Use "usabmx" o "uci"',
        data: null
      };
    }

    return await getOptimizedEvents(
      { 
        source: mappedSource,
        search: search?.trim()
      },
      { 
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20
      }
    );
  })

  /**
   * GET /api/v2/events/with-coordinates - Eventos con coordenadas (para mapas)
   */
  .get('/with-coordinates', async ({ query }) => {
    const { limit, page } = query as { limit?: string; page?: string };
    
    return await getOptimizedEvents(
      { hasCoordinates: true },
      { 
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 50 // Más resultados para mapas
      }
    );
  })

  /**
   * GET /api/v2/events/by-country/:country - Eventos por país
   */
  .get('/by-country/:country', async ({ params, query }) => {
    const { country } = params as { country: string };
    const { limit, page } = query as { limit?: string; page?: string };
    
    return await getOptimizedEvents(
      { country: decodeURIComponent(country) },
      { 
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20
      }
    );
  })

  /**
   * GET /api/v2/events/recent - Eventos agregados recientemente
   */
  .get('/recent', async ({ query }) => {
    const { limit, days } = query as { limit?: string; days?: string };
    
    const daysAgo = days ? parseInt(days) : 7;
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    
    return await getOptimizedEvents(
      { startDate },
      { 
        limit: limit ? parseInt(limit) : 20,
        sortBy: 'created_at',
        sortOrder: 'desc'
      }
    );
  });
