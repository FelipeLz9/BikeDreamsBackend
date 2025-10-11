// Mock global fetch antes de importaciones
global.fetch = jest.fn();

// Mock de normalizers
const mockNormalizeNews = jest.fn((news) => ({
  id: news.id || 'mock-id',
  title: news.title || 'Mock News',
  date: news.date || '2024-01-01T00:00:00Z',
  url: news.url || 'http://mock.url',
  source: news.source || 'USABMX'
}));

jest.mock('../../utils/normalizers', () => ({
  normalizeNews: mockNormalizeNews
}));

// Mock de PrismaClient con patrón simple
const mockPrismaFindMany = jest.fn();
const mockPrismaFindUnique = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    news: {
      findMany: mockPrismaFindMany,
      findUnique: mockPrismaFindUnique
    }
  }))
}));

// Importar después de los mocks
import { getNews, getNewsById } from '../../controllers/newsController';

describe('📰 NewsController Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCRAPER_API_URL = 'http://localhost:4000';
  });

  describe('getNews', () => {
    test('should return news from database when available', async () => {
      const mockDbNews = [
        {
          id: '1',
          external_id: 'news-1',
          uuid_id: 'uuid-1',
          title: 'Test News 1',
          published_at: new Date('2024-02-01'),
          date: new Date('2024-02-01'),
          category: 'Racing',
          url: 'http://test.com/news1',
          author: 'Test Author',
          summary: 'Test summary',
          excerpt: 'Test excerpt',
          source: 'USABMX',
          createdAt: new Date('2024-02-01')
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDbNews);

      const result = await getNews();

      expect(result.total).toBe(1);
      expect(result.dataSource).toBe('database');
      expect(result.sources.usabmx).toBe(1);
      expect(result.news).toBeDefined();
      expect(result.news[0].id).toBe('news-1');
      expect(result.news[0].title).toBe('Test News 1');
      
      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        orderBy: [
          { published_at: 'desc' },
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
    });

    test('should handle news with uuid_id when external_id is null', async () => {
      const mockDbNews = [
        {
          id: '1',
          external_id: null,
          uuid_id: 'uuid-123',
          title: 'UUID News',
          published_at: new Date('2024-02-01'),
          source: 'UCI'
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDbNews);

      const result = await getNews();

      expect(result.news[0].id).toBe('uuid-123');
    });

    test('should fallback to scraper API when no database news', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      const mockUsabmxNews = [{ title: 'USABMX News', summary: 'USABMX Summary' }];
      const mockUciNews = [{ title: 'UCI News', author: 'UCI Author' }];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUsabmxNews)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUciNews)
        });

      const result = await getNews();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/news/usabmx/', expect.any(Object));
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/news/uci/', expect.any(Object));
      expect(mockNormalizeNews).toHaveBeenCalledTimes(2);
      expect(result.dataSource).toBe('scraper-api');
      expect(result.total).toBe(2);
    });

    test('should handle API errors gracefully', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await getNews();

      expect(result.total).toBe(0);
      expect(result.news).toEqual([]);
      expect(result.sources).toEqual({ usabmx: 0, uci: 0 });
    });

    test('should handle database errors', async () => {
      mockPrismaFindMany.mockRejectedValue(new Error('Database error'));

      const result = await getNews();

      expect(result.total).toBe(0);
      expect(result.news).toEqual([]);
      expect(result.error).toBe('Database error');
    });

    test('should count news by source correctly', async () => {
      const mockDbNews = [
        { id: '1', title: 'USABMX News 1', source: 'USABMX', published_at: new Date('2024-02-01') },
        { id: '2', title: 'USABMX News 2', source: 'USABMX', published_at: new Date('2024-02-02') },
        { id: '3', title: 'UCI News 1', source: 'UCI', published_at: new Date('2024-02-03') }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDbNews);

      const result = await getNews();

      expect(result.total).toBe(3);
      expect(result.sources).toEqual({ usabmx: 2, uci: 1 });
    });

    test('should handle partial API failures', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      const mockUsabmxNews = [{ title: 'USABMX News' }];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUsabmxNews)
        })
        .mockRejectedValueOnce(new Error('UCI API Error'));

      const result = await getNews();

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

      const result = await getNews();

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

      const result = await getNews();

      expect(result).toEqual({
        total: 0,
        news: [],
        sources: { usabmx: 0, uci: 0 },
        dataSource: 'scraper-api'
      });
    });

    test('should handle news with minimal data', async () => {
      const mockDbNews = [
        {
          id: '1',
          external_id: null,
          uuid_id: null,
          title: 'Minimal News',
          published_at: null,
          date: null,
          createdAt: new Date('2024-02-01'),
          source: 'USABMX'
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDbNews);

      const result = await getNews();

      expect(result.total).toBe(1);
      expect(result.news[0].id).toBe('1');
      expect(result.news[0].title).toBe('Minimal News');
      expect(result.news[0].date).toEqual(new Date('2024-02-01'));
    });

    test('should prioritize published_at over date over createdAt for date field', async () => {
      const mockDbNews = [
        {
          id: '1',
          title: 'News with published_at',
          published_at: new Date('2024-02-01'),
          date: new Date('2024-01-01'),
          createdAt: new Date('2024-01-15'),
          source: 'USABMX'
        },
        {
          id: '2',
          title: 'News with date only',
          published_at: null,
          date: new Date('2024-02-02'),
          createdAt: new Date('2024-01-15'),
          source: 'USABMX'
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDbNews);

      const result = await getNews();

      expect(result.news[0].date).toEqual(new Date('2024-02-01')); // published_at priority
      expect(result.news[1].date).toEqual(new Date('2024-02-02')); // date priority
    });

    test('should handle JSON parsing errors from API', async () => {
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

      const result = await getNews();

      expect(result.sources.usabmx).toBe(0);
      expect(result.sources.uci).toBe(0);
    });
  });

  describe('getNewsById', () => {
    test('should return news from USABMX API by ID', async () => {
      const mockNewsData = { 
        id: '123', 
        title: 'Test News', 
        summary: 'Test summary' 
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockNewsData)
        });

      const result = await getNewsById('123');

      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/news/usabmx/id/123', expect.any(Object));
      expect(mockNormalizeNews).toHaveBeenCalledWith(mockNewsData);
      expect(result).toBeDefined();
    });

    test('should fallback to UCI API if not found in USABMX', async () => {
      const mockNewsData = { 
        id: '123', 
        title: 'UCI News', 
        image: 'image.jpg' 
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ error: 'Not found' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockNewsData)
        });

      const result = await getNewsById('123');

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/news/usabmx/id/123', expect.any(Object));
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/news/uci/id/123', expect.any(Object));
      expect(mockNormalizeNews).toHaveBeenCalledWith(mockNewsData);
    });

    test('should handle array responses from API', async () => {
      const mockNewsArray = [{ 
        id: '123', 
        title: 'Array News', 
        summary: 'From array' 
      }];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockNewsArray)
        });

      const result = await getNewsById('123');

      expect(mockNormalizeNews).toHaveBeenCalledWith(mockNewsArray[0]);
    });

    test('should return null if news not found in any source', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ error: 'Not found' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ error: 'Not found' })
        });

      const result = await getNewsById('nonexistent');

      expect(result).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should handle API errors gracefully', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('USABMX API Error'))
        .mockRejectedValueOnce(new Error('UCI API Error'));

      const result = await getNewsById('123');

      expect(result).toBeNull();
    });

    test('should handle partial API failures', async () => {
      const mockNewsData = { 
        id: '123', 
        title: 'UCI News Success' 
      };

      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('USABMX API Error'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockNewsData)
        });

      const result = await getNewsById('123');

      expect(mockNormalizeNews).toHaveBeenCalledWith(mockNewsData);
      expect(result).toBeDefined();
    });

    test('should handle empty array responses', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([])
        });

      const result = await getNewsById('123');

      expect(result).toBeNull();
    });

    test('should handle JSON parsing errors', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockRejectedValue(new Error('JSON Parse Error'))
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: '123', title: 'Backup News' })
        });

      const result = await getNewsById('123');

      expect(mockNormalizeNews).toHaveBeenCalledWith({ id: '123', title: 'Backup News' });
    });

    test('should handle null or undefined responses', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(null)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(undefined)
        });

      const result = await getNewsById('123');

      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle network timeouts', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('TimeoutError'))
        .mockRejectedValueOnce(new Error('TimeoutError'));

      const result = await getNews();

      expect(result.total).toBe(0);
      expect(result.sources).toEqual({ usabmx: 0, uci: 0 });
    });

    test('should handle malformed API responses', async () => {
      mockPrismaFindMany.mockResolvedValue([]);
      
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue("invalid json format")
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ invalid: 'structure' })
        });

      const result = await getNews();

      expect(result.total).toBe(0);
    });
  });
});
