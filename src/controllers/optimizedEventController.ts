import { PrismaClient } from '@prisma/client';
import { ApiResponse, createErrorResponse, createSuccessResponse } from '../utils/apiResponse';

const prisma = new PrismaClient();

interface EventFilters {
  search?: string;
  source?: 'USABMX' | 'UCI' | 'both';
  timeFilter?: 'upcoming' | 'past' | 'all';
  country?: string;
  continent?: string;
  startDate?: string;
  endDate?: string;
  hasCoordinates?: boolean;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'title' | 'location' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Obtiene eventos con paginación avanzada y filtros optimizados
 */
export async function getOptimizedEvents(
  filters: EventFilters = {},
  pagination: PaginationParams = {}
): Promise<ApiResponse> {
  try {
    // Parámetros de paginación con valores por defecto
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;
    const sortBy = pagination.sortBy || 'date';
    const sortOrder = pagination.sortOrder || 'desc';

    // Construir filtros dinámicos
    const where: any = {};

    // Filtro de búsqueda de texto
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { location: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
        { country: { contains: searchTerm, mode: 'insensitive' } },
        { state: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Filtro por fuente
    if (filters.source && filters.source !== 'both') {
      where.source = filters.source;
    }

    // Filtro temporal
    const now = new Date();
    if (filters.timeFilter === 'upcoming') {
      where.OR = [
        { start_date: { gte: now } },
        { AND: [{ start_date: null }, { date: { gte: now } }] }
      ];
    } else if (filters.timeFilter === 'past') {
      where.OR = [
        { end_date: { lt: now } },
        { AND: [{ end_date: null }, { start_date: { lt: now } }] },
        { AND: [{ start_date: null }, { end_date: null }, { date: { lt: now } }] }
      ];
    }

    // Filtros geográficos
    if (filters.country) {
      where.country = { contains: filters.country, mode: 'insensitive' };
    }
    if (filters.continent) {
      where.continent = { contains: filters.continent, mode: 'insensitive' };
    }

    // Filtro por rango de fechas
    if (filters.startDate || filters.endDate) {
      const dateFilter: any = {};
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        dateFilter.lte = new Date(filters.endDate);
      }
      where.OR = [
        { start_date: dateFilter },
        { AND: [{ start_date: null }, { date: dateFilter }] }
      ];
    }

    // Filtro por coordenadas
    if (filters.hasCoordinates === true) {
      where.AND = [
        { latitude: { not: null } },
        { longitude: { not: null } }
      ];
    } else if (filters.hasCoordinates === false) {
      where.OR = [
        { latitude: null },
        { longitude: null }
      ];
    }

    // Configurar ordenamiento
    let orderBy: any;
    if (sortBy === 'date') {
      // Priorizar start_date sobre date
      orderBy = [
        { start_date: sortOrder },
        { date: sortOrder }
      ];
    } else if (sortBy === 'title') {
      orderBy = { title: sortOrder };
    } else if (sortBy === 'location') {
      orderBy = { location: sortOrder };
    } else if (sortBy === 'created_at') {
      orderBy = { createdAt: sortOrder };
    }

    // Ejecutar consulta con paginación
    const [events, totalCount] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          title: true,
          date: true,
          start_date: true,
          end_date: true,
          location: true,
          city: true,
          state: true,
          country: true,
          continent: true,
          latitude: true,
          longitude: true,
          details_url: true,
          is_uci_event: true,
          source: true,
          external_id: true,
          createdAt: true
        }
      }),
      prisma.event.count({ where })
    ]);

    // Calcular estadísticas adicionales si es útil
    const [sourceStats, locationStats] = await Promise.all([
      // Estadísticas por fuente
      prisma.event.groupBy({
        by: ['source'],
        where,
        _count: { source: true }
      }),
      // Top países/ubicaciones
      prisma.event.groupBy({
        by: ['country'],
        where: { ...where, country: { not: null } },
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
        take: 5
      })
    ]);

    // Formatear eventos
    const formattedEvents = events.map(event => ({
      id: event.external_id || event.id,
      title: event.title || event.name,
      name: event.name,
      date: event.start_date || event.date,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
      city: event.city,
      state: event.state,
      country: event.country,
      continent: event.continent,
      latitude: event.latitude ? parseFloat(event.latitude) : null,
      longitude: event.longitude ? parseFloat(event.longitude) : null,
      details_url: event.details_url,
      is_uci_event: event.is_uci_event,
      source: event.source,
      created_at: event.createdAt
    }));

    // Calcular información de paginación
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return createSuccessResponse({
      events: formattedEvents,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
        startIndex: skip + 1,
        endIndex: Math.min(skip + limit, totalCount)
      },
      filters: {
        applied: filters,
        available: {
          sources: sourceStats.map(stat => ({
            source: stat.source,
            count: stat._count.source
          })),
          topCountries: locationStats.map(stat => ({
            country: stat.country,
            count: stat._count.country
          }))
        }
      },
      meta: {
        queryTime: Date.now(),
        cached: false,
        sortedBy: sortBy,
        sortOrder
      }
    }, `${totalCount} eventos obtenidos exitosamente`);

  } catch (error) {
    console.error('Error in getOptimizedEvents:', error);
    return createErrorResponse('Error obteniendo eventos', String(error));
  }
}

/**
 * Obtiene estadísticas rápidas de eventos
 */
export async function getEventStats(): Promise<ApiResponse> {
  try {
    const [
      totalEvents,
      upcomingEvents,
      eventsWithCoords,
      sourceBreakdown,
      continentBreakdown,
      recentEvents
    ] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({
        where: {
          OR: [
            { start_date: { gte: new Date() } },
            { AND: [{ start_date: null }, { date: { gte: new Date() } }] }
          ]
        }
      }),
      prisma.event.count({
        where: {
          AND: [
            { latitude: { not: null } },
            { longitude: { not: null } }
          ]
        }
      }),
      prisma.event.groupBy({
        by: ['source'],
        _count: { source: true }
      }),
      prisma.event.groupBy({
        by: ['continent'],
        where: { continent: { not: null } },
        _count: { continent: true },
        orderBy: { _count: { continent: 'desc' } }
      }),
      prisma.event.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ]);

    return createSuccessResponse({
      totals: {
        all: totalEvents,
        upcoming: upcomingEvents,
        past: totalEvents - upcomingEvents,
        withCoordinates: eventsWithCoords,
        recent: recentEvents
      },
      breakdown: {
        bySources: sourceBreakdown.reduce((acc, item) => {
          acc[item.source?.toLowerCase() || 'unknown'] = item._count.source;
          return acc;
        }, {} as Record<string, number>),
        byContinents: continentBreakdown.reduce((acc, item) => {
          acc[item.continent?.toLowerCase() || 'unknown'] = item._count.continent;
          return acc;
        }, {} as Record<string, number>)
      },
      percentages: {
        upcomingRate: totalEvents > 0 ? Math.round((upcomingEvents / totalEvents) * 100) : 0,
        coordinatesRate: totalEvents > 0 ? Math.round((eventsWithCoords / totalEvents) * 100) : 0
      }
    }, 'Estadísticas de eventos obtenidas');

  } catch (error) {
    console.error('Error in getEventStats:', error);
    return createErrorResponse('Error obteniendo estadísticas', String(error));
  }
}

/**
 * Busca eventos con autocompletado
 */
export async function searchEventsAutocomplete(query: string, limit: number = 10): Promise<ApiResponse> {
  try {
    if (!query || query.length < 2) {
      return createSuccessResponse([], 'Query muy corto para búsqueda');
    }

    const searchTerm = query.toLowerCase();
    
    const results = await prisma.event.findMany({
      where: {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { location: { contains: searchTerm, mode: 'insensitive' } },
          { city: { contains: searchTerm, mode: 'insensitive' } },
          { country: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        title: true,
        name: true,
        location: true,
        city: true,
        country: true,
        date: true,
        start_date: true,
        source: true
      },
      take: limit,
      orderBy: [
        { start_date: 'desc' },
        { date: 'desc' }
      ]
    });

    const suggestions = results.map(event => ({
      id: event.id,
      title: event.title || event.name,
      location: event.location,
      city: event.city,
      country: event.country,
      date: event.start_date || event.date,
      source: event.source
    }));

    return createSuccessResponse(suggestions, `${suggestions.length} sugerencias encontradas`);

  } catch (error) {
    console.error('Error in searchEventsAutocomplete:', error);
    return createErrorResponse('Error en búsqueda', String(error));
  }
}
