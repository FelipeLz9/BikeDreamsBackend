import { describe, expect, it, beforeEach } from '@jest/globals';
import { Elysia } from 'elysia';
import { syncRoutes } from '../../../routes/sync.js';

// Mock de los controladores de sincronización
const mockSyncController = {
  checkScraperHealth: jest.fn(),
  syncEvents: jest.fn(),
  syncNews: jest.fn(),
  syncAll: jest.fn(),
  getSyncStats: jest.fn()
};

jest.mock('../../../controllers/syncController.js', () => mockSyncController);

// Mock del middleware de auth
jest.mock('../../../middleware/auth.js', () => ({
  authMiddleware: new (require('elysia').Elysia)().derive(() => ({
    user: { id: 'admin-123', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN' },
    isAuthenticated: true,
    clientIp: '192.168.1.100',
    userAgent: 'test-agent/1.0'
  }))
}));

describe('🔄 Sync Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new Elysia().use(syncRoutes);
  });

  describe('GET /sync/health', () => {
    const mockHealthData = {
      success: true,
      data: {
        scraper: {
          status: 'healthy',
          uptime: '24h 30m',
          lastCheck: '2024-01-15T12:00:00Z'
        },
        services: {
          usabmx: { status: 'up', responseTime: '250ms' },
          uci: { status: 'up', responseTime: '180ms' }
        },
        database: {
          status: 'connected',
          pool: { active: 2, idle: 8, total: 10 }
        }
      },
      message: 'Scraper health check completed'
    };

    it('should get scraper health status successfully', async () => {
      mockSyncController.checkScraperHealth.mockResolvedValue(mockHealthData);

      const response = await app.handle(new Request('http://localhost/sync/health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockHealthData);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.scraper.status).toBe('healthy');
      expect(mockSyncController.checkScraperHealth).toHaveBeenCalledTimes(1);
    });

    it('should handle unhealthy scraper status', async () => {
      const unhealthyData = {
        success: false,
        data: {
          scraper: { status: 'unhealthy', error: 'Connection timeout' },
          services: {
            usabmx: { status: 'down', error: 'Service unavailable' },
            uci: { status: 'up', responseTime: '180ms' }
          }
        },
        message: 'Scraper health issues detected'
      };

      mockSyncController.checkScraperHealth.mockResolvedValue(unhealthyData);

      const response = await app.handle(new Request('http://localhost/sync/health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.data.scraper.status).toBe('unhealthy');
    });

    it('should handle controller errors', async () => {
      mockSyncController.checkScraperHealth.mockRejectedValue(
        new Error('Health check failed')
      );

      const response = await app.handle(new Request('http://localhost/sync/health'));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /sync/stats', () => {
    const mockStatsData = {
      success: true,
      data: {
        totalEvents: 1250,
        totalNews: 340,
        lastSyncTime: '2024-01-15T10:30:00Z',
        syncHistory: {
          successful: 48,
          failed: 2,
          lastWeek: 50
        },
        sources: {
          usabmx: { events: 890, news: 200, lastSync: '2024-01-15T10:30:00Z' },
          uci: { events: 360, news: 140, lastSync: '2024-01-15T10:25:00Z' }
        }
      },
      message: 'Sync statistics retrieved'
    };

    it('should get sync statistics successfully', async () => {
      mockSyncController.getSyncStats.mockResolvedValue(mockStatsData);

      const response = await app.handle(new Request('http://localhost/sync/stats'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockStatsData);
      expect(responseBody.data.totalEvents).toBe(1250);
      expect(responseBody.data.totalNews).toBe(340);
      expect(mockSyncController.getSyncStats).toHaveBeenCalledTimes(1);
    });

    it('should handle empty statistics', async () => {
      const emptyStats = {
        success: true,
        data: {
          totalEvents: 0,
          totalNews: 0,
          lastSyncTime: null,
          syncHistory: { successful: 0, failed: 0, lastWeek: 0 }
        },
        message: 'No sync data available'
      };

      mockSyncController.getSyncStats.mockResolvedValue(emptyStats);

      const response = await app.handle(new Request('http://localhost/sync/stats'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.totalEvents).toBe(0);
      expect(responseBody.data.lastSyncTime).toBeNull();
    });

    it('should handle stats retrieval errors', async () => {
      mockSyncController.getSyncStats.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await app.handle(new Request('http://localhost/sync/stats'));

      expect(response.status).toBe(500);
    });
  });

  describe('POST /sync/events', () => {
    const mockEventsSync = {
      success: true,
      data: {
        usabmx: {
          processed: 45,
          added: 12,
          updated: 8,
          errors: []
        },
        uci: {
          processed: 28,
          added: 5,
          updated: 3,
          errors: []
        },
        summary: {
          totalProcessed: 73,
          totalAdded: 17,
          totalUpdated: 11,
          duration: '2.3s'
        }
      },
      message: 'Events synchronization completed successfully'
    };

    it('should sync events successfully', async () => {
      mockSyncController.syncEvents.mockResolvedValue(mockEventsSync);

      const response = await app.handle(new Request('http://localhost/sync/events', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockEventsSync);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.summary.totalAdded).toBe(17);
      expect(mockSyncController.syncEvents).toHaveBeenCalledTimes(1);
    });

    it('should handle sync with errors', async () => {
      const syncWithErrors = {
        success: false,
        data: {
          usabmx: {
            processed: 30,
            added: 5,
            updated: 0,
            errors: ['Connection timeout', 'Invalid data format']
          },
          uci: {
            processed: 0,
            added: 0,
            updated: 0,
            errors: ['Service unavailable']
          }
        },
        message: 'Events synchronization completed with errors'
      };

      mockSyncController.syncEvents.mockResolvedValue(syncWithErrors);

      const response = await app.handle(new Request('http://localhost/sync/events', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.data.usabmx.errors).toHaveLength(2);
    });

    it('should handle sync controller errors', async () => {
      mockSyncController.syncEvents.mockRejectedValue(
        new Error('Sync process failed')
      );

      const response = await app.handle(new Request('http://localhost/sync/events', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('POST /sync/news', () => {
    const mockNewsSync = {
      success: true,
      data: {
        usabmx: {
          processed: 25,
          added: 8,
          updated: 4,
          errors: []
        },
        uci: {
          processed: 15,
          added: 3,
          updated: 2,
          errors: []
        },
        summary: {
          totalProcessed: 40,
          totalAdded: 11,
          totalUpdated: 6,
          duration: '1.8s'
        }
      },
      message: 'News synchronization completed successfully'
    };

    it('should sync news successfully', async () => {
      mockSyncController.syncNews.mockResolvedValue(mockNewsSync);

      const response = await app.handle(new Request('http://localhost/sync/news', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockNewsSync);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.summary.totalAdded).toBe(11);
      expect(mockSyncController.syncNews).toHaveBeenCalledTimes(1);
    });

    it('should handle partial sync success', async () => {
      const partialSync = {
        success: true,
        data: {
          usabmx: {
            processed: 20,
            added: 6,
            updated: 2,
            errors: ['Duplicate entry skipped']
          },
          uci: {
            processed: 0,
            added: 0,
            updated: 0,
            errors: ['Rate limit exceeded']
          }
        },
        message: 'News synchronization partially completed'
      };

      mockSyncController.syncNews.mockResolvedValue(partialSync);

      const response = await app.handle(new Request('http://localhost/sync/news', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.usabmx.added).toBe(6);
      expect(responseBody.data.uci.processed).toBe(0);
    });
  });

  describe('POST /sync/all', () => {
    const mockFullSync = {
      success: true,
      data: {
        events: {
          usabmx: { processed: 45, added: 12, updated: 8 },
          uci: { processed: 28, added: 5, updated: 3 }
        },
        news: {
          usabmx: { processed: 25, added: 8, updated: 4 },
          uci: { processed: 15, added: 3, updated: 2 }
        },
        summary: {
          totalEventsProcessed: 73,
          totalNewsProcessed: 40,
          totalAdded: 28,
          totalUpdated: 17,
          duration: '4.5s'
        }
      },
      message: 'Full synchronization completed successfully'
    };

    it('should sync all data successfully', async () => {
      mockSyncController.syncAll.mockResolvedValue(mockFullSync);

      const response = await app.handle(new Request('http://localhost/sync/all', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockFullSync);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.summary.totalAdded).toBe(28);
      expect(responseBody.data.summary.totalUpdated).toBe(17);
      expect(mockSyncController.syncAll).toHaveBeenCalledTimes(1);
    });

    it('should handle full sync with mixed results', async () => {
      const mixedSync = {
        success: true,
        data: {
          events: {
            usabmx: { processed: 30, added: 5, updated: 2, errors: ['Connection timeout'] },
            uci: { processed: 20, added: 8, updated: 1, errors: [] }
          },
          news: {
            usabmx: { processed: 15, added: 2, updated: 1, errors: [] },
            uci: { processed: 0, added: 0, updated: 0, errors: ['Service down'] }
          }
        },
        message: 'Full synchronization completed with some issues'
      };

      mockSyncController.syncAll.mockResolvedValue(mixedSync);

      const response = await app.handle(new Request('http://localhost/sync/all', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.events.usabmx.errors).toHaveLength(1);
      expect(responseBody.data.news.uci.errors).toHaveLength(1);
    });

    it('should handle complete sync failure', async () => {
      mockSyncController.syncAll.mockRejectedValue(
        new Error('Critical sync failure')
      );

      const response = await app.handle(new Request('http://localhost/sync/all', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('Route Integration and Error Handling', () => {
    it('should handle all sync endpoints with proper HTTP methods', async () => {
      const endpoints = [
        { path: '/sync/health', method: 'GET' },
        { path: '/sync/stats', method: 'GET' },
        { path: '/sync/events', method: 'POST' },
        { path: '/sync/news', method: 'POST' },
        { path: '/sync/all', method: 'POST' }
      ];

      for (const endpoint of endpoints) {
        // Mock successful responses for all controllers
        mockSyncController.checkScraperHealth.mockResolvedValue({ success: true });
        mockSyncController.getSyncStats.mockResolvedValue({ success: true });
        mockSyncController.syncEvents.mockResolvedValue({ success: true });
        mockSyncController.syncNews.mockResolvedValue({ success: true });
        mockSyncController.syncAll.mockResolvedValue({ success: true });

        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: endpoint.method
          })
        );

        expect(response.status).not.toBe(404);
        expect(response.status).not.toBe(405); // Method not allowed
      }
    });

    it('should require authentication for all endpoints', async () => {
      // This test verifies that authMiddleware is applied
      mockSyncController.checkScraperHealth.mockImplementation((context) => {
        expect(context).toHaveProperty('user');
        expect(context.user.role).toBe('ADMIN');
        return Promise.resolve({ success: true });
      });

      const response = await app.handle(new Request('http://localhost/sync/health'));

      expect(response.status).toBe(200);
    });

    it('should handle concurrent sync operations', async () => {
      mockSyncController.syncEvents.mockResolvedValue({ success: true, data: {} });
      mockSyncController.syncNews.mockResolvedValue({ success: true, data: {} });

      const requests = [
        app.handle(new Request('http://localhost/sync/events', { method: 'POST' })),
        app.handle(new Request('http://localhost/sync/news', { method: 'POST' }))
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockSyncController.syncEvents).toHaveBeenCalledTimes(1);
      expect(mockSyncController.syncNews).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid HTTP methods gracefully', async () => {
      const response = await app.handle(new Request('http://localhost/sync/health', {
        method: 'POST' // Invalid method for health endpoint
      }));

      expect(response.status).toBe(405); // Method not allowed
    });

    it('should provide consistent response format', async () => {
      const endpoints = [
        { path: '/sync/health', method: 'GET', controller: 'checkScraperHealth' },
        { path: '/sync/stats', method: 'GET', controller: 'getSyncStats' },
        { path: '/sync/events', method: 'POST', controller: 'syncEvents' },
        { path: '/sync/news', method: 'POST', controller: 'syncNews' },
        { path: '/sync/all', method: 'POST', controller: 'syncAll' }
      ];

      for (const endpoint of endpoints) {
        const mockResponse = {
          success: true,
          data: { test: 'data' },
          message: 'Test message'
        };

        (mockSyncController as any)[endpoint.controller].mockResolvedValue(mockResponse);

        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: endpoint.method
          })
        );

        expect(response.status).toBe(200);
        
        const responseBody = await response.json();
        expect(responseBody).toHaveProperty('success');
        expect(responseBody).toHaveProperty('data');
        expect(responseBody).toHaveProperty('message');
      }
    });
  });

  describe('Security and Performance', () => {
    it('should handle large sync responses', async () => {
      const largeSyncData = {
        success: true,
        data: {
          events: Array.from({ length: 1000 }, (_, i) => ({ id: i, title: `Event ${i}` })),
          summary: { totalProcessed: 1000, duration: '15.2s' }
        },
        message: 'Large sync completed'
      };

      mockSyncController.syncAll.mockResolvedValue(largeSyncData);

      const response = await app.handle(new Request('http://localhost/sync/all', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.events).toHaveLength(1000);
    });

    it('should handle authentication context properly', async () => {
      mockSyncController.syncEvents.mockImplementation((context) => {
        expect(context.user.id).toBe('admin-123');
        expect(context.isAuthenticated).toBe(true);
        return Promise.resolve({ success: true, data: {} });
      });

      const response = await app.handle(new Request('http://localhost/sync/events', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
    });

    it('should handle timeout scenarios', async () => {
      mockSyncController.syncAll.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: false,
              message: 'Sync operation timed out'
            });
          }, 1000); // Simulate timeout
        });
      });

      const response = await app.handle(new Request('http://localhost/sync/all', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toContain('timed out');
    });
  });
});