// Mock global fetch first
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Prisma Client
const mockPrismaEvent = {
  upsert: jest.fn()
};
const mockPrismaNews = {
  upsert: jest.fn()
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    event: mockPrismaEvent,
    news: mockPrismaNews
  })),
  EventSource: {
    USABMX: 'USABMX',
    UCI: 'UCI'
  },
  NewsSource: {
    USABMX: 'USABMX',
    UCI: 'UCI'
  }
}));

import { scraperIntegrationService } from '../../services/scraperIntegration';

// Mock console methods to avoid test noise
const originalConsole = console;
const mockConsole = {
  log: jest.fn(),
  error: jest.fn()
};

describe('🔄 ScraperIntegrationService Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    mockPrismaEvent.upsert.mockClear();
    mockPrismaNews.upsert.mockClear();
    
    // Mock console to avoid noise in tests
    console.log = mockConsole.log;
    console.error = mockConsole.error;
  });

  afterAll(() => {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;
  });

  describe('fetchEventsFromScraper', () => {
    it('should fetch events from both USABMX and UCI successfully', async () => {
      const mockUsabmxResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          total: 2,
          events: [
            { title: 'USABMX Race 1', location: 'California', date: '2024-01-15' },
            { title: 'USABMX Race 2', location: 'Texas', date: '2024-01-20' }
          ]
        })
      };

      const mockUciResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          total: 1,
          events: [
            { title: 'UCI World Cup', location: 'France', date: '2024-02-01' }
          ]
        })
      };

      mockFetch
        .mockResolvedValueOnce(mockUsabmxResponse)
        .mockResolvedValueOnce(mockUciResponse);

      const result = await scraperIntegrationService.fetchEventsFromScraper();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/events/usabmx/');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/events/uci/');
      
      expect(result.usabmx).toHaveLength(2);
      expect(result.uci).toHaveLength(1);
      expect(result.usabmx[0].title).toBe('USABMX Race 1');
      expect(result.uci[0].title).toBe('UCI World Cup');
    });

    it('should handle failed USABMX request but successful UCI request', async () => {
      const mockUsabmxResponse = { ok: false, status: 500 };
      const mockUciResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          events: [{ title: 'UCI Event', location: 'Spain' }]
        })
      };

      mockFetch
        .mockResolvedValueOnce(mockUsabmxResponse)
        .mockResolvedValueOnce(mockUciResponse);

      const result = await scraperIntegrationService.fetchEventsFromScraper();

      expect(result.usabmx).toHaveLength(0);
      expect(result.uci).toHaveLength(1);
      expect(mockConsole.error).toHaveBeenCalledWith('❌ USABMX request failed:', 500);
    });

    it('should handle JSON parsing errors', async () => {
      const mockUsabmxResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };
      const mockUciResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ events: [] })
      };

      mockFetch
        .mockResolvedValueOnce(mockUsabmxResponse)
        .mockResolvedValueOnce(mockUciResponse);

      const result = await scraperIntegrationService.fetchEventsFromScraper();

      expect(result.usabmx).toHaveLength(0);
      expect(result.uci).toHaveLength(0);
      expect(mockConsole.error).toHaveBeenCalledWith('❌ Error parsing USABMX response:', expect.any(Error));
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await scraperIntegrationService.fetchEventsFromScraper();

      expect(result.usabmx).toHaveLength(0);
      expect(result.uci).toHaveLength(0);
      // The service handles network errors at individual API level, not global level
      expect(mockConsole.error).toHaveBeenCalledWith('❌ USABMX request failed:', expect.any(Error));
      expect(mockConsole.error).toHaveBeenCalledWith('❌ UCI request failed:', expect.any(Error));
    });

    it('should handle malformed API response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ malformed: 'data' })
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await scraperIntegrationService.fetchEventsFromScraper();

      expect(result.usabmx).toHaveLength(0);
      expect(result.uci).toHaveLength(0);
    });

    it('should handle empty events array', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ events: [] })
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await scraperIntegrationService.fetchEventsFromScraper();

      expect(result.usabmx).toHaveLength(0);
      expect(result.uci).toHaveLength(0);
    });
  });

  describe('fetchNewsFromScraper', () => {
    it('should fetch news from both sources successfully', async () => {
      const mockUsabmxResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          total: 1,
          news: [
            { id: 1, title: 'USABMX News', published_at: '2024-01-15', summary: 'Test summary' }
          ]
        })
      };

      const mockUciResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          total: 1,
          news: [
            { id: 'uci-1', title: 'UCI News', date: '2024-01-16', author: 'UCI Author' }
          ]
        })
      };

      mockFetch
        .mockResolvedValueOnce(mockUsabmxResponse)
        .mockResolvedValueOnce(mockUciResponse);

      const result = await scraperIntegrationService.fetchNewsFromScraper();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/news/');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/news/uci/');
      expect(result.usabmx).toHaveLength(1);
      expect(result.uci).toHaveLength(1);
    });

    it('should handle news API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('News API error'));

      const result = await scraperIntegrationService.fetchNewsFromScraper();

      expect(result.usabmx).toHaveLength(0);
      expect(result.uci).toHaveLength(0);
      // The service handles network errors at individual API level, not global level
      expect(mockConsole.error).toHaveBeenCalledWith('❌ USABMX news request failed:', expect.any(Error));
      expect(mockConsole.error).toHaveBeenCalledWith('❌ UCI news request failed:', expect.any(Error));
    });
  });

  describe('syncEvents', () => {
    it('should sync events successfully', async () => {
      const mockEvents = {
        usabmx: [
          { title: 'Event 1', location: 'Location 1', date: '2024-01-15' }
        ],
        uci: [
          { title: 'Event 2', location: 'Location 2', start_date: '2024-02-01', end_date: '2024-02-03' }
        ]
      };

      // Mock the fetchEventsFromScraper method
      jest.spyOn(scraperIntegrationService, 'fetchEventsFromScraper').mockResolvedValue(mockEvents);
      
      mockPrismaEvent.upsert.mockResolvedValue({ id: 'event-1' });

      const result = await scraperIntegrationService.syncEvents();

      expect(result.success).toBe(true);
      expect(result.usabmx).toBe(1);
      expect(result.uci).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPrismaEvent.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors during event sync', async () => {
      const mockEvents = {
        usabmx: [{ title: 'Event 1', location: 'Location 1' }],
        uci: []
      };

      jest.spyOn(scraperIntegrationService, 'fetchEventsFromScraper').mockResolvedValue(mockEvents);
      mockPrismaEvent.upsert.mockRejectedValue(new Error('Database error'));

      const result = await scraperIntegrationService.syncEvents();

      expect(result.success).toBe(true); // Still returns true if partial success
      expect(result.usabmx).toBe(0); // Failed to sync
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Error sincronizando evento USABMX');
    });

    it('should handle invalid data format', async () => {
      jest.spyOn(scraperIntegrationService, 'fetchEventsFromScraper').mockResolvedValue({
        usabmx: 'invalid' as any,
        uci: null as any
      });

      const result = await scraperIntegrationService.syncEvents();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid data format');
    });

    it('should handle complete failure during fetch', async () => {
      jest.spyOn(scraperIntegrationService, 'fetchEventsFromScraper').mockRejectedValue(new Error('Fetch failed'));

      const result = await scraperIntegrationService.syncEvents();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Error general sincronizando eventos');
    });
  });

  describe('syncNews', () => {
    it('should sync news successfully', async () => {
      const mockNews = {
        usabmx: [
          { id: 1, title: 'News 1', summary: 'Summary 1', published_at: '2024-01-15' }
        ],
        uci: [
          { id: 'uci-1', title: 'News 2', summary: 'Summary 2', date: '2024-01-16' }
        ]
      };

      jest.spyOn(scraperIntegrationService, 'fetchNewsFromScraper').mockResolvedValue(mockNews);
      mockPrismaNews.upsert.mockResolvedValue({ id: 'news-1' });

      const result = await scraperIntegrationService.syncNews();

      expect(result.success).toBe(true);
      expect(result.usabmx).toBe(1);
      expect(result.uci).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPrismaNews.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failure in news sync', async () => {
      const mockNews = {
        usabmx: [{ id: 1, title: 'News 1' }],
        uci: [{ id: 'uci-1', title: 'News 2' }]
      };

      jest.spyOn(scraperIntegrationService, 'fetchNewsFromScraper').mockResolvedValue(mockNews);
      
      mockPrismaNews.upsert
        .mockResolvedValueOnce({ id: 'news-1' })
        .mockRejectedValueOnce(new Error('Database constraint violation'));

      const result = await scraperIntegrationService.syncNews();

      expect(result.success).toBe(true);
      expect(result.usabmx).toBe(1);
      expect(result.uci).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Error sincronizando noticia UCI');
    });
  });

  describe('syncAll', () => {
    it('should sync both events and news successfully', async () => {
      const mockEventsResult = {
        success: true,
        usabmx: 2,
        uci: 1,
        errors: []
      };

      const mockNewsResult = {
        success: true,
        usabmx: 1,
        uci: 2,
        errors: []
      };

      jest.spyOn(scraperIntegrationService, 'syncEvents').mockResolvedValue(mockEventsResult);
      jest.spyOn(scraperIntegrationService, 'syncNews').mockResolvedValue(mockNewsResult);

      const result = await scraperIntegrationService.syncAll();

      expect(result.success).toBe(true);
      expect(result.events).toEqual({ usabmx: 2, uci: 1 });
      expect(result.news).toEqual({ usabmx: 1, uci: 2 });
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial failures in syncAll', async () => {
      const mockEventsResult = {
        success: true,
        usabmx: 1,
        uci: 0,
        errors: ['Event sync error']
      };

      const mockNewsResult = {
        success: false,
        usabmx: 0,
        uci: 0,
        errors: ['News sync error']
      };

      jest.spyOn(scraperIntegrationService, 'syncEvents').mockResolvedValue(mockEventsResult);
      jest.spyOn(scraperIntegrationService, 'syncNews').mockResolvedValue(mockNewsResult);

      const result = await scraperIntegrationService.syncAll();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Event sync error');
      expect(result.errors).toContain('News sync error');
    });
  });

  describe('checkScraperHealth', () => {
    it('should return healthy status when scraper is accessible', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await scraperIntegrationService.checkScraperHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.scraperUrl).toBe('http://localhost:4000');
      expect(result.error).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/', { 
        signal: expect.any(AbortSignal) 
      });
    });

    it('should return unhealthy status when scraper returns error', async () => {
      const mockResponse = { ok: false };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await scraperIntegrationService.checkScraperHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.scraperUrl).toBe('http://localhost:4000');
      expect(result.error).toBeUndefined();
    });

    it('should handle network errors in health check', async () => {
      const networkError = new Error('Network unreachable');
      mockFetch.mockRejectedValue(networkError);

      const result = await scraperIntegrationService.checkScraperHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.scraperUrl).toBe('http://localhost:4000');
      expect(result.error).toBe('Error: Network unreachable');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      mockFetch.mockRejectedValue(timeoutError);

      const result = await scraperIntegrationService.checkScraperHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.error).toBe('Error: Timeout');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      // Restore original methods before each edge case test
      jest.restoreAllMocks();
      console.log = mockConsole.log;
      console.error = mockConsole.error;
    });

    it('should handle missing environment variable for SCRAPER_API_URL', async () => {
      // Test with default URL when env var is not set
      const originalEnv = process.env.SCRAPER_API_URL;
      delete process.env.SCRAPER_API_URL;

      const mockResponse = { ok: true };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await scraperIntegrationService.checkScraperHealth();

      expect(result.scraperUrl).toBe('http://localhost:4000');
      
      // Restore environment variable
      if (originalEnv) process.env.SCRAPER_API_URL = originalEnv;
    });

    it('should handle very large datasets', async () => {
      const largeEventsList = Array.from({ length: 1000 }, (_, i) => ({
        title: `Event ${i}`,
        location: `Location ${i}`,
        date: '2024-01-01'
      }));

      const mockEvents = {
        usabmx: largeEventsList,
        uci: []
      };

      jest.spyOn(scraperIntegrationService, 'fetchEventsFromScraper').mockResolvedValue(mockEvents);
      mockPrismaEvent.upsert.mockResolvedValue({ id: 'event' });

      const result = await scraperIntegrationService.syncEvents();

      expect(result.success).toBe(true);
      expect(result.usabmx).toBe(1000);
      expect(mockPrismaEvent.upsert).toHaveBeenCalledTimes(1000);
    });

    it('should handle concurrent execution correctly', async () => {
      jest.spyOn(scraperIntegrationService, 'syncEvents').mockResolvedValue({
        success: true, usabmx: 1, uci: 1, errors: []
      });
      jest.spyOn(scraperIntegrationService, 'syncNews').mockResolvedValue({
        success: true, usabmx: 1, uci: 1, errors: []
      });

      const promises = [
        scraperIntegrationService.syncAll(),
        scraperIntegrationService.syncAll(),
        scraperIntegrationService.syncAll()
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle corrupted data gracefully', async () => {
      const corruptedEvents = {
        usabmx: [
          { title: null, location: undefined, date: 'invalid-date' },
          { /* completely empty object */ },
          { title: 'Valid Event', location: 'Valid Location', date: '2024-01-01' }
        ],
        uci: []
      };

      jest.spyOn(scraperIntegrationService, 'fetchEventsFromScraper').mockResolvedValue(corruptedEvents);
      
      // Simulate database rejecting invalid data
      mockPrismaEvent.upsert
        .mockRejectedValueOnce(new Error('Invalid data'))
        .mockRejectedValueOnce(new Error('Missing required fields'))
        .mockResolvedValueOnce({ id: 'valid-event' });

      const result = await scraperIntegrationService.syncEvents();

      expect(result.success).toBe(true);
      expect(result.usabmx).toBe(1); // Only valid event synced
      expect(result.errors).toHaveLength(2); // Two errors for invalid events
    });
  });
});
