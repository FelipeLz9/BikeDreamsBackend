import { describe, expect, it, beforeEach } from '@jest/globals';
import { Elysia } from 'elysia';
import { optimizedEventRoutes } from '../../../routes/optimized-events.js';

// Mock de los controladores de eventos optimizados
const mockOptimizedEventController = {
  getOptimizedEvents: jest.fn(),
  getEventStats: jest.fn(),
  searchEventsAutocomplete: jest.fn()
};

jest.mock('../../../controllers/optimizedEventController.js', () => mockOptimizedEventController);

describe('⚡ Optimized Event Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new Elysia().use(optimizedEventRoutes);
  });

  describe('GET /v2/events', () => {
    const mockEventsData = {
      success: true,
      data: {
        events: [
          {
            id: '1',
            title: 'BMX World Championships',
            location: 'Paris, France',
            date: '2024-07-15T10:00:00Z',
            source: 'UCI',
            coordinates: { lat: 48.8566, lng: 2.3522 },
            country: 'France',
            continent: 'Europe'
          },
          {
            id: '2',
            title: 'USA BMX National Series',
            location: 'Phoenix, AZ, USA',
            date: '2024-08-20T14:00:00Z',
            source: 'USABMX',
            coordinates: { lat: 33.4484, lng: -112.0740 },
            country: 'USA',
            continent: 'North America'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 150,
          totalPages: 8,
          hasNext: true,
          hasPrevious: false
        },
        filters: {
          applied: {
            search: null,
            source: 'both',
            timeFilter: 'all',
            hasCoordinates: null
          }
        }
      },
      message: 'Optimized events retrieved successfully'
    };

    it('should get events with default parameters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockEventsData);
      expect(responseBody.data.events).toHaveLength(2);
      expect(responseBody.data.pagination.total).toBe(150);

      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        {
          search: undefined,
          source: undefined,
          timeFilter: undefined,
          country: undefined,
          continent: undefined,
          startDate: undefined,
          endDate: undefined,
          hasCoordinates: undefined
        },
        {
          page: undefined,
          limit: undefined,
          sortBy: undefined,
          sortOrder: undefined
        }
      );
    });

    it('should handle search parameter', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events?search=BMX%20Championship'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'BMX Championship'
        }),
        expect.any(Object)
      );
    });

    it('should handle pagination parameters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events?page=2&limit=10'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          page: 2,
          limit: 10
        })
      );
    });

    it('should handle source filter', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events?source=UCI'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'UCI'
        }),
        expect.any(Object)
      );
    });

    it('should handle time filter', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events?timeFilter=upcoming'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          timeFilter: 'upcoming'
        }),
        expect.any(Object)
      );
    });

    it('should handle coordinates filter', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events?hasCoordinates=true'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          hasCoordinates: true
        }),
        expect.any(Object)
      );
    });

    it('should handle date range filters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const startDate = '2024-07-01T00:00:00Z';
      const endDate = '2024-12-31T23:59:59Z';

      const response = await app.handle(
        new Request(`http://localhost/v2/events?startDate=${startDate}&endDate=${endDate}`)
      );

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate,
          endDate
        }),
        expect.any(Object)
      );
    });

    it('should handle sorting parameters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events?sortBy=date&sortOrder=asc'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          sortBy: 'date',
          sortOrder: 'asc'
        })
      );
    });

    it('should handle country and continent filters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events?country=France&continent=Europe'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'France',
          continent: 'Europe'
        }),
        expect.any(Object)
      );
    });

    it('should handle complex query with multiple filters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const complexUrl = 'http://localhost/v2/events?search=BMX&source=UCI&timeFilter=upcoming&country=France&hasCoordinates=true&page=2&limit=5&sortBy=title&sortOrder=desc';

      const response = await app.handle(new Request(complexUrl));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        {
          search: 'BMX',
          source: 'UCI',
          timeFilter: 'upcoming',
          country: 'France',
          continent: undefined,
          startDate: undefined,
          endDate: undefined,
          hasCoordinates: true
        },
        {
          page: 2,
          limit: 5,
          sortBy: 'title',
          sortOrder: 'desc'
        }
      );
    });

    it('should handle controller errors', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await app.handle(new Request('http://localhost/v2/events'));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /v2/events/stats', () => {
    const mockStatsData = {
      success: true,
      data: {
        totalEvents: 1250,
        upcomingEvents: 345,
        pastEvents: 905,
        bySource: {
          USABMX: 890,
          UCI: 360
        },
        byCountry: {
          USA: 450,
          France: 180,
          Germany: 120,
          others: 500
        },
        withCoordinates: 1150,
        recentlyAdded: {
          last24h: 12,
          lastWeek: 45,
          lastMonth: 180
        }
      },
      message: 'Event statistics retrieved successfully'
    };

    it('should get event statistics', async () => {
      mockOptimizedEventController.getEventStats.mockResolvedValue(mockStatsData);

      const response = await app.handle(new Request('http://localhost/v2/events/stats'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockStatsData);
      expect(responseBody.data.totalEvents).toBe(1250);
      expect(responseBody.data.bySource.USABMX).toBe(890);
      expect(mockOptimizedEventController.getEventStats).toHaveBeenCalledTimes(1);
    });

    it('should handle stats controller errors', async () => {
      mockOptimizedEventController.getEventStats.mockRejectedValue(
        new Error('Stats service unavailable')
      );

      const response = await app.handle(new Request('http://localhost/v2/events/stats'));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /v2/events/search/autocomplete', () => {
    const mockAutocompleteData = {
      success: true,
      data: [
        {
          id: '1',
          title: 'BMX World Championships',
          location: 'Paris, France',
          type: 'event'
        },
        {
          id: '2',
          title: 'BMX National Series',
          location: 'Phoenix, AZ',
          type: 'event'
        }
      ],
      message: 'Autocomplete results retrieved successfully'
    };

    it('should get autocomplete results with valid query', async () => {
      mockOptimizedEventController.searchEventsAutocomplete.mockResolvedValue(mockAutocompleteData);

      const response = await app.handle(new Request('http://localhost/v2/events/search/autocomplete?q=BMX'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockAutocompleteData);
      expect(responseBody.data).toHaveLength(2);
      expect(mockOptimizedEventController.searchEventsAutocomplete).toHaveBeenCalledWith('BMX', 10);
    });

    it('should handle custom limit parameter', async () => {
      mockOptimizedEventController.searchEventsAutocomplete.mockResolvedValue(mockAutocompleteData);

      const response = await app.handle(new Request('http://localhost/v2/events/search/autocomplete?q=Championship&limit=5'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.searchEventsAutocomplete).toHaveBeenCalledWith('Championship', 5);
    });

    it('should enforce maximum limit', async () => {
      mockOptimizedEventController.searchEventsAutocomplete.mockResolvedValue(mockAutocompleteData);

      const response = await app.handle(new Request('http://localhost/v2/events/search/autocomplete?q=BMX&limit=100'));

      expect(response.status).toBe(200);
      
      // Should be capped at 25
      expect(mockOptimizedEventController.searchEventsAutocomplete).toHaveBeenCalledWith('BMX', 25);
    });

    it('should reject queries that are too short', async () => {
      const response = await app.handle(new Request('http://localhost/v2/events/search/autocomplete?q=B'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toBe('Query debe tener al menos 2 caracteres');
      expect(responseBody.data).toEqual([]);
      expect(mockOptimizedEventController.searchEventsAutocomplete).not.toHaveBeenCalled();
    });

    it('should reject queries without q parameter', async () => {
      const response = await app.handle(new Request('http://localhost/v2/events/search/autocomplete'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toBe('Query debe tener al menos 2 caracteres');
      expect(mockOptimizedEventController.searchEventsAutocomplete).not.toHaveBeenCalled();
    });

    it('should handle autocomplete controller errors', async () => {
      mockOptimizedEventController.searchEventsAutocomplete.mockRejectedValue(
        new Error('Search service unavailable')
      );

      const response = await app.handle(new Request('http://localhost/v2/events/search/autocomplete?q=BMX'));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /v2/events/upcoming', () => {
    it('should get upcoming events with default parameters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/upcoming'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { timeFilter: 'upcoming' },
        { 
          page: 1,
          limit: 20,
          sortBy: 'date',
          sortOrder: 'asc'
        }
      );
    });

    it('should handle custom pagination for upcoming events', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/upcoming?page=2&limit=10'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { timeFilter: 'upcoming' },
        { 
          page: 2,
          limit: 10,
          sortBy: 'date',
          sortOrder: 'asc'
        }
      );
    });
  });

  describe('GET /v2/events/past', () => {
    it('should get past events with default parameters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/past'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { timeFilter: 'past' },
        { 
          page: 1,
          limit: 20,
          sortBy: 'date',
          sortOrder: 'desc'
        }
      );
    });

    it('should handle custom pagination for past events', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/past?page=3&limit=15'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { timeFilter: 'past' },
        { 
          page: 3,
          limit: 15,
          sortBy: 'date',
          sortOrder: 'desc'
        }
      );
    });
  });

  describe('GET /v2/events/by-source/:source', () => {
    it('should get events by USABMX source', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/by-source/usabmx'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { 
          source: 'USABMX',
          search: undefined
        },
        { 
          page: 1,
          limit: 20
        }
      );
    });

    it('should get events by UCI source', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/by-source/uci'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { 
          source: 'UCI',
          search: undefined
        },
        { 
          page: 1,
          limit: 20
        }
      );
    });

    it('should handle invalid source parameter', async () => {
      const response = await app.handle(new Request('http://localhost/v2/events/by-source/invalid'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toBe('Fuente inválida. Use "usabmx" o "uci"');
      expect(mockOptimizedEventController.getOptimizedEvents).not.toHaveBeenCalled();
    });

    it('should handle search parameter with source filter', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/by-source/usabmx?search=National&page=2'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { 
          source: 'USABMX',
          search: 'National'
        },
        { 
          page: 2,
          limit: 20
        }
      );
    });
  });

  describe('GET /v2/events/with-coordinates', () => {
    it('should get events with coordinates', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/with-coordinates'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { hasCoordinates: true },
        { 
          page: 1,
          limit: 50
        }
      );
    });

    it('should handle custom pagination for coordinated events', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/with-coordinates?page=2&limit=25'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { hasCoordinates: true },
        { 
          page: 2,
          limit: 25
        }
      );
    });
  });

  describe('GET /v2/events/by-country/:country', () => {
    it('should get events by country', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/by-country/France'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { country: 'France' },
        { 
          page: 1,
          limit: 20
        }
      );
    });

    it('should handle URL encoded country names', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/by-country/United%20States'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { country: 'United States' },
        { 
          page: 1,
          limit: 20
        }
      );
    });

    it('should handle pagination for country-filtered events', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/by-country/Germany?page=3&limit=15'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { country: 'Germany' },
        { 
          page: 3,
          limit: 15
        }
      );
    });
  });

  describe('GET /v2/events/recent', () => {
    it('should get recent events with default parameters', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/recent'));

      expect(response.status).toBe(200);
      
      const expectedStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { startDate: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/) },
        { 
          limit: 20,
          sortBy: 'created_at',
          sortOrder: 'desc'
        }
      );
    });

    it('should handle custom days parameter', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/v2/events/recent?days=30&limit=50'));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        { startDate: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/) },
        { 
          limit: 50,
          sortBy: 'created_at',
          sortOrder: 'desc'
        }
      );
    });
  });

  describe('Route Integration and Error Handling', () => {
    it('should handle all endpoints with proper HTTP methods', async () => {
      const endpoints = [
        { path: '/v2/events', method: 'GET' },
        { path: '/v2/events/stats', method: 'GET' },
        { path: '/v2/events/search/autocomplete?q=BMX', method: 'GET' },
        { path: '/v2/events/upcoming', method: 'GET' },
        { path: '/v2/events/past', method: 'GET' },
        { path: '/v2/events/by-source/usabmx', method: 'GET' },
        { path: '/v2/events/with-coordinates', method: 'GET' },
        { path: '/v2/events/by-country/France', method: 'GET' },
        { path: '/v2/events/recent', method: 'GET' }
      ];

      for (const endpoint of endpoints) {
        // Mock successful responses for all controllers
        mockOptimizedEventController.getOptimizedEvents.mockResolvedValue({ success: true, data: { events: [] } });
        mockOptimizedEventController.getEventStats.mockResolvedValue({ success: true, data: {} });
        mockOptimizedEventController.searchEventsAutocomplete.mockResolvedValue({ success: true, data: [] });

        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: endpoint.method
          })
        );

        expect(response.status).not.toBe(404);
        expect(response.status).not.toBe(405);
      }
    });

    it('should not require authentication (public endpoints)', async () => {
      // Optimized event routes should be public
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue({ success: true, data: { events: [] } });

      const response = await app.handle(new Request('http://localhost/v2/events'));

      expect(response.status).toBe(200);
    });

    it('should handle concurrent requests efficiently', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue({ success: true, data: { events: [] } });
      mockOptimizedEventController.getEventStats.mockResolvedValue({ success: true, data: {} });

      const requests = [
        app.handle(new Request('http://localhost/v2/events')),
        app.handle(new Request('http://localhost/v2/events/stats')),
        app.handle(new Request('http://localhost/v2/events/upcoming'))
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledTimes(2);
      expect(mockOptimizedEventController.getEventStats).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid query parameters gracefully', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue({ success: true, data: { events: [] } });

      const response = await app.handle(new Request('http://localhost/v2/events?page=invalid&limit=notanumber'));

      expect(response.status).toBe(200);
      
      // Should handle invalid parameters and use defaults or undefined
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          page: undefined,
          limit: undefined
        })
      );
    });

    it('should handle special characters in search queries', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue({ success: true, data: { events: [] } });

      const specialQuery = 'BMX & MTB "Championships" 2024!';
      const encodedQuery = encodeURIComponent(specialQuery);

      const response = await app.handle(new Request(`http://localhost/v2/events?search=${encodedQuery}`));

      expect(response.status).toBe(200);
      
      expect(mockOptimizedEventController.getOptimizedEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          search: specialQuery
        }),
        expect.any(Object)
      );
    });

    it('should provide consistent response format across all endpoints', async () => {
      const mockResponse = {
        success: true,
        data: { events: [], total: 0 },
        message: 'Test response'
      };

      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue(mockResponse);
      mockOptimizedEventController.getEventStats.mockResolvedValue(mockResponse);

      const endpoints = ['/v2/events', '/v2/events/stats'];

      for (const endpoint of endpoints) {
        const response = await app.handle(new Request(`http://localhost${endpoint}`));
        
        expect(response.status).toBe(200);
        
        const responseBody = await response.json();
        expect(responseBody).toHaveProperty('success');
        expect(responseBody).toHaveProperty('data');
        expect(responseBody).toHaveProperty('message');
      }
    });

    it('should handle edge cases in date calculations', async () => {
      mockOptimizedEventController.getOptimizedEvents.mockResolvedValue({ success: true, data: { events: [] } });

      // Test with zero days (should default to 7)
      const response1 = await app.handle(new Request('http://localhost/v2/events/recent?days=0'));
      expect(response1.status).toBe(200);

      // Test with very large days value
      const response2 = await app.handle(new Request('http://localhost/v2/events/recent?days=999999'));
      expect(response2.status).toBe(200);

      // Test with negative days (should be handled gracefully)
      const response3 = await app.handle(new Request('http://localhost/v2/events/recent?days=-5'));
      expect(response3.status).toBe(200);
    });
  });
});