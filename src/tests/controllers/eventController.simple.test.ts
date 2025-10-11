// Mock global fetch antes de importaciones
global.fetch = jest.fn();

// Mock de normalizers
const mockNormalizeEvent = jest.fn((event) => ({
  id: event.id || 'mock-id',
  title: event.title || 'Mock Event',
  date: event.date || '2024-01-01T00:00:00Z',
  location: event.location || 'Mock Location',
  source: event.source || 'USABMX'
}));

jest.mock('../../utils/normalizers', () => ({
  normalizeEvent: mockNormalizeEvent
}));

// Mock de PrismaClient con patrón simple
const mockPrismaFindMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    event: {
      findMany: mockPrismaFindMany
    }
  }))
}));

// Importar después de los mocks
import { getEvents, getUpcomingEvents, getPastEvents } from '../../controllers/eventController';

describe('🎯 EventController Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCRAPER_API_URL = 'http://localhost:4000';
  });

  describe('getEvents', () => {
    test('should return events from database when available', async () => {
      const mockDbEvents = [
        {
          id: '1',
          external_id: 'event-1',
          title: 'Test Event 1',
          date: new Date('2024-02-01'),
          start_date: new Date('2024-02-01'),
          location: 'Test Location',
          source: 'USABMX',
          is_uci_event: false,
          city: 'Test City',
          state: 'Test State',
          country: 'USA'
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDbEvents);

      const result = await getEvents();

      expect(result.total).toBe(1);
      expect(result.dataSource).toBe('database');
      expect(result.sources.usabmx).toBe(1);
      expect(result.events).toBeDefined();
      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { date: 'desc' }
      });
    });

    test('should handle upcoming events filter', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      await getEvents('upcoming');

      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: { date: { gte: expect.any(Date) } },
        orderBy: { date: 'desc' }
      });
    });

    test('should handle past events filter', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      await getEvents('past');

      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: { date: { lt: expect.any(Date) } },
        orderBy: { date: 'desc' }
      });
    });

    test('should fallback to scraper API when no database events', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      const mockUsabmxEvents = [{ title: 'USABMX Event', location: 'USABMX Location' }];
      const mockUciEvents = [{ title: 'UCI Event', country: 'France' }];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUsabmxEvents)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUciEvents)
        });

      const result = await getEvents();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(mockNormalizeEvent).toHaveBeenCalledTimes(2);
      expect(result.dataSource).toBe('scraper-api');
      expect(result.total).toBe(2);
    });

    test('should handle API errors gracefully', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await getEvents();

      expect(result.total).toBe(0);
      expect(result.events).toEqual([]);
      expect(result.sources).toEqual({ usabmx: 0, uci: 0 });
    });

    test('should handle database errors', async () => {
      mockPrismaFindMany.mockRejectedValue(new Error('Database error'));

      const result = await getEvents();

      expect(result.total).toBe(0);
      expect(result.events).toEqual([]);
      expect(result.error).toBe('Database error');
    });

    test('should count events by source correctly', async () => {
      const mockDbEvents = [
        { id: '1', title: 'USABMX Event 1', source: 'USABMX', date: new Date('2024-02-01'), location: 'Location 1' },
        { id: '2', title: 'USABMX Event 2', source: 'USABMX', date: new Date('2024-02-02'), location: 'Location 2' },
        { id: '3', title: 'UCI Event 1', source: 'UCI', date: new Date('2024-02-03'), location: 'Location 3' }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDbEvents);

      const result = await getEvents();

      expect(result.total).toBe(3);
      expect(result.sources).toEqual({ usabmx: 2, uci: 1 });
    });

    test('should handle partial API failures', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      const mockUsabmxEvents = [{ title: 'USABMX Event' }];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUsabmxEvents)
        })
        .mockRejectedValueOnce(new Error('UCI API Error'));

      const result = await getEvents();

      expect(result.total).toBe(1);
      expect(result.sources.usabmx).toBe(1);
      expect(result.sources.uci).toBe(0);
    });

    test('should handle invalid API responses', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValue('Server Error')
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(null)
        });

      const result = await getEvents();

      expect(result.total).toBe(0);
      expect(result.sources).toEqual({ usabmx: 0, uci: 0 });
    });

    test('should handle empty responses', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([])
        });

      const result = await getEvents();

      expect(result).toEqual({
        total: 0,
        events: [],
        sources: { usabmx: 0, uci: 0 },
        dataSource: 'scraper-api'
      });
    });

    test('should handle events with minimal data', async () => {
      const mockDbEvents = [
        {
          id: '1',
          external_id: null,
          title: 'Minimal Event',
          date: new Date('2024-02-01'),
          location: null,
          source: 'USABMX',
          is_uci_event: false
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDbEvents);

      const result = await getEvents();

      expect(result.total).toBe(1);
      expect(result.events[0].id).toBe('1');
      expect(result.events[0].title).toBe('Minimal Event');
    });

    test('should handle JSON parsing errors', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockRejectedValue(new Error('JSON Parse Error'))
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([])
        });

      const result = await getEvents();

      expect(result.sources.usabmx).toBe(0);
      expect(result.sources.uci).toBe(0);
    });
  });

  describe('getUpcomingEvents', () => {
    test('should call getEvents with upcoming filter', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      await getUpcomingEvents();

      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: { date: { gte: expect.any(Date) } },
        orderBy: { date: 'desc' }
      });
    });
  });

  describe('getPastEvents', () => {
    test('should call getEvents with past filter', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      await getPastEvents();

      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: { date: { lt: expect.any(Date) } },
        orderBy: { date: 'desc' }
      });
    });
  });
});
