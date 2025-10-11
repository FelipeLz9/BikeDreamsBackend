import { describe, expect, it, beforeEach } from '@jest/globals';
import { Elysia } from 'elysia';
import { syncDebugRoutes } from '../../../routes/sync-debug.js';

// Mock de los controladores de sincronización (reutilizados de sync-debug)
const mockSyncController = {
  checkScraperHealth: jest.fn(),
  syncEvents: jest.fn(),
  syncNews: jest.fn(),
  getSyncStats: jest.fn()
};

jest.mock('../../../controllers/syncController.js', () => mockSyncController);

// Mock del console para verificar logging de debug
const originalConsole = console;
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

describe('🐛 Sync Debug Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    // Replace console during tests to capture debug output
    Object.assign(console, mockConsole);
    app = new Elysia().use(syncDebugRoutes);
  });

  afterEach(() => {
    // Restore original console
    Object.assign(console, originalConsole);
  });

  describe('GET /debug/scraper-health', () => {
    const mockHealthData = {
      success: true,
      data: {
        scraper: {
          status: 'healthy',
          uptime: '24h 30m',
          lastCheck: '2024-01-15T12:00:00Z',
          version: '1.2.3'
        },
        services: {
          usabmx: { 
            status: 'up', 
            responseTime: '250ms',
            lastSuccess: '2024-01-15T11:58:00Z'
          },
          uci: { 
            status: 'up', 
            responseTime: '180ms',
            lastSuccess: '2024-01-15T11:59:00Z'
          }
        },
        database: {
          status: 'connected',
          pool: { active: 2, idle: 8, total: 10 },
          latency: '5ms'
        }
      },
      message: 'Scraper health check completed successfully'
    };

    it('should get scraper health with debug logging', async () => {
      mockSyncController.checkScraperHealth.mockResolvedValue(mockHealthData);

      const response = await app.handle(new Request('http://localhost/debug/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockHealthData);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.scraper.status).toBe('healthy');

      // Verify debug logging
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug health endpoint called');
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug health result:', mockHealthData);
      expect(mockSyncController.checkScraperHealth).toHaveBeenCalledTimes(1);
    });

    it('should handle unhealthy scraper status with debug logging', async () => {
      const unhealthyData = {
        success: false,
        data: {
          scraper: { 
            status: 'unhealthy', 
            error: 'Connection timeout',
            lastError: '2024-01-15T12:00:00Z'
          },
          services: {
            usabmx: { 
              status: 'down', 
              error: 'Service unavailable',
              lastFailure: '2024-01-15T11:58:00Z'
            },
            uci: { 
              status: 'up', 
              responseTime: '180ms' 
            }
          }
        },
        message: 'Scraper health issues detected'
      };

      mockSyncController.checkScraperHealth.mockResolvedValue(unhealthyData);

      const response = await app.handle(new Request('http://localhost/debug/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.data.scraper.status).toBe('unhealthy');

      // Verify debug logging even for unhealthy status
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug health endpoint called');
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug health result:', unhealthyData);
    });

    it('should handle health check controller errors', async () => {
      mockSyncController.checkScraperHealth.mockRejectedValue(
        new Error('Health check service unavailable')
      );

      const response = await app.handle(new Request('http://localhost/debug/scraper-health'));

      expect(response.status).toBe(500);
      
      // Debug endpoint should still log the attempt
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug health endpoint called');
    });
  });

  describe('GET /debug/sync-stats', () => {
    const mockStatsData = {
      success: true,
      data: {
        totalEvents: 1250,
        totalNews: 340,
        lastSyncTime: '2024-01-15T10:30:00Z',
        syncHistory: {
          successful: 48,
          failed: 2,
          lastWeek: 50,
          averageDuration: 2.1
        },
        sources: {
          usabmx: { 
            events: 890, 
            news: 200, 
            lastSync: '2024-01-15T10:30:00Z',
            status: 'active'
          },
          uci: { 
            events: 360, 
            news: 140, 
            lastSync: '2024-01-15T10:25:00Z',
            status: 'active'
          }
        },
        performance: {
          avgSyncTime: '2.1s',
          maxSyncTime: '5.8s',
          minSyncTime: '0.8s'
        }
      },
      message: 'Sync statistics retrieved successfully'
    };

    it('should get sync statistics with debug logging', async () => {
      mockSyncController.getSyncStats.mockResolvedValue(mockStatsData);

      const response = await app.handle(new Request('http://localhost/debug/sync-stats'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockStatsData);
      expect(responseBody.data.totalEvents).toBe(1250);
      expect(responseBody.data.totalNews).toBe(340);

      // Verify debug logging
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug stats endpoint called');
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug stats result:', 'Success');
      expect(mockSyncController.getSyncStats).toHaveBeenCalledTimes(1);
    });

    it('should handle empty statistics with debug logging', async () => {
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

      const response = await app.handle(new Request('http://localhost/debug/sync-stats'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.totalEvents).toBe(0);
      expect(responseBody.data.lastSyncTime).toBeNull();

      // Verify debug logging for empty stats
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug stats endpoint called');
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug stats result:', 'Success');
    });

    it('should handle failed statistics with debug logging', async () => {
      const failedStats = {
        success: false,
        data: null,
        message: 'Statistics retrieval failed'
      };

      mockSyncController.getSyncStats.mockResolvedValue(failedStats);

      const response = await app.handle(new Request('http://localhost/debug/sync-stats'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);

      // Debug should log failure as well
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug stats endpoint called');
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug stats result:', 'Failed');
    });

    it('should handle stats retrieval errors', async () => {
      mockSyncController.getSyncStats.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await app.handle(new Request('http://localhost/debug/sync-stats'));

      expect(response.status).toBe(500);
      
      // Should still log the attempt
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug stats endpoint called');
    });
  });

  describe('POST /debug/sync-events', () => {
    const mockEventsSync = {
      success: true,
      data: {
        usabmx: {
          processed: 45,
          added: 12,
          updated: 8,
          errors: [],
          duration: '1.8s'
        },
        uci: {
          processed: 28,
          added: 5,
          updated: 3,
          errors: [],
          duration: '1.2s'
        },
        summary: {
          totalProcessed: 73,
          totalAdded: 17,
          totalUpdated: 11,
          duration: '3.0s'
        }
      },
      message: 'Events synchronization completed successfully'
    };

    it('should sync events with detailed debug logging', async () => {
      mockSyncController.syncEvents.mockResolvedValue(mockEventsSync);

      const response = await app.handle(new Request('http://localhost/debug/sync-events', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockEventsSync);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.summary.totalAdded).toBe(17);

      // Verify detailed debug logging
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug events endpoint called');
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug events result:', {
        success: mockEventsSync.success,
        usabmx: mockEventsSync.data.usabmx,
        uci: mockEventsSync.data.uci,
        errors: 0
      });
      expect(mockSyncController.syncEvents).toHaveBeenCalledTimes(1);
    });

    it('should handle sync with errors and detailed logging', async () => {
      const syncWithErrors = {
        success: false,
        data: {
          usabmx: {
            processed: 30,
            added: 5,
            updated: 0,
            errors: ['Connection timeout', 'Invalid data format'],
            duration: '2.5s'
          },
          uci: {
            processed: 0,
            added: 0,
            updated: 0,
            errors: ['Service unavailable'],
            duration: '0s'
          }
        },
        message: 'Events synchronization completed with errors'
      };

      mockSyncController.syncEvents.mockResolvedValue(syncWithErrors);

      const response = await app.handle(new Request('http://localhost/debug/sync-events', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.data.usabmx.errors).toHaveLength(2);
      expect(responseBody.data.uci.errors).toHaveLength(1);

      // Verify error count logging
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug events endpoint called');
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug events result:', {
        success: syncWithErrors.success,
        usabmx: syncWithErrors.data.usabmx,
        uci: syncWithErrors.data.uci,
        errors: 3 // Total errors from both sources
      });
    });

    it('should handle sync controller errors with error logging', async () => {
      const syncError = new Error('Critical sync failure');
      mockSyncController.syncEvents.mockRejectedValue(syncError);

      const response = await app.handle(new Request('http://localhost/debug/sync-events', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);

      // Verify error logging
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug events endpoint called');
      expect(mockConsole.error).toHaveBeenCalledWith('🔍 Debug events error:', syncError);
    });

    it('should handle partial sync results with detailed logging', async () => {
      const partialSync = {
        success: true,
        data: {
          usabmx: {
            processed: 20,
            added: 8,
            updated: 2,
            errors: ['Duplicate entry skipped'],
            duration: '1.5s'
          },
          uci: {
            processed: 0,
            added: 0,
            updated: 0,
            errors: ['Rate limit exceeded'],
            duration: '0s'
          }
        },
        message: 'Events synchronization partially completed'
      };

      mockSyncController.syncEvents.mockResolvedValue(partialSync);

      const response = await app.handle(new Request('http://localhost/debug/sync-events', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.usabmx.added).toBe(8);
      expect(responseBody.data.uci.processed).toBe(0);

      // Verify detailed logging includes error count
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug events result:', {
        success: partialSync.success,
        usabmx: partialSync.data.usabmx,
        uci: partialSync.data.uci,
        errors: 2
      });
    });
  });

  describe('POST /debug/sync-news', () => {
    const mockNewsSync = {
      success: true,
      data: {
        usabmx: {
          processed: 25,
          added: 8,
          updated: 4,
          errors: [],
          duration: '1.2s'
        },
        uci: {
          processed: 15,
          added: 3,
          updated: 2,
          errors: [],
          duration: '0.9s'
        },
        summary: {
          totalProcessed: 40,
          totalAdded: 11,
          totalUpdated: 6,
          duration: '2.1s'
        }
      },
      message: 'News synchronization completed successfully'
    };

    it('should sync news with detailed debug logging', async () => {
      mockSyncController.syncNews.mockResolvedValue(mockNewsSync);

      const response = await app.handle(new Request('http://localhost/debug/sync-news', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockNewsSync);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.summary.totalAdded).toBe(11);

      // Verify detailed debug logging
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug news endpoint called');
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug news result:', {
        success: mockNewsSync.success,
        usabmx: mockNewsSync.data.usabmx,
        uci: mockNewsSync.data.uci,
        errors: 0
      });
      expect(mockSyncController.syncNews).toHaveBeenCalledTimes(1);
    });

    it('should handle news sync errors with detailed logging', async () => {
      const syncError = new Error('News sync service down');
      mockSyncController.syncNews.mockRejectedValue(syncError);

      const response = await app.handle(new Request('http://localhost/debug/sync-news', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);

      // Verify error logging
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug news endpoint called');
      expect(mockConsole.error).toHaveBeenCalledWith('🔍 Debug news error:', syncError);
    });

    it('should handle news sync with mixed results', async () => {
      const mixedResults = {
        success: true,
        data: {
          usabmx: {
            processed: 20,
            added: 6,
            updated: 2,
            errors: ['Duplicate entry'],
            duration: '1.8s'
          },
          uci: {
            processed: 0,
            added: 0,
            updated: 0,
            errors: ['Service timeout', 'Invalid response'],
            duration: '0s'
          }
        },
        message: 'News synchronization completed with issues'
      };

      mockSyncController.syncNews.mockResolvedValue(mixedResults);

      const response = await app.handle(new Request('http://localhost/debug/sync-news', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.usabmx.added).toBe(6);
      expect(responseBody.data.uci.errors).toHaveLength(2);

      // Verify error count in logging
      expect(mockConsole.log).toHaveBeenCalledWith('🔍 Debug news result:', {
        success: mixedResults.success,
        usabmx: mixedResults.data.usabmx,
        uci: mixedResults.data.uci,
        errors: 3 // Total errors from both sources
      });
    });
  });

  describe('Route Integration and Error Handling', () => {
    it('should handle all debug endpoints with proper HTTP methods', async () => {
      const endpoints = [
        { path: '/debug/scraper-health', method: 'GET' },
        { path: '/debug/sync-stats', method: 'GET' },
        { path: '/debug/sync-events', method: 'POST' },
        { path: '/debug/sync-news', method: 'POST' }
      ];

      for (const endpoint of endpoints) {
        // Mock successful responses for all controllers
        mockSyncController.checkScraperHealth.mockResolvedValue({ success: true });
        mockSyncController.getSyncStats.mockResolvedValue({ success: true });
        mockSyncController.syncEvents.mockResolvedValue({ 
          success: true, 
          data: { usabmx: {}, uci: {}, errors: [] } 
        });
        mockSyncController.syncNews.mockResolvedValue({ 
          success: true, 
          data: { usabmx: {}, uci: {}, errors: [] } 
        });

        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: endpoint.method
          })
        );

        expect(response.status).not.toBe(404);
        expect(response.status).not.toBe(405);
      }
    });

    it('should not require authentication (debug endpoints)', async () => {
      // Debug endpoints should be accessible without authentication for debugging purposes
      mockSyncController.checkScraperHealth.mockResolvedValue({ success: true });

      const response = await app.handle(new Request('http://localhost/debug/scraper-health'));

      expect(response.status).toBe(200);
      // No authentication middleware should be applied to debug routes
    });

    it('should provide consistent debug logging format', async () => {
      const endpoints = [
        { path: '/debug/scraper-health', method: 'GET', controller: 'checkScraperHealth' },
        { path: '/debug/sync-stats', method: 'GET', controller: 'getSyncStats' }
      ];

      for (const endpoint of endpoints) {
        (mockSyncController as any)[endpoint.controller].mockResolvedValue({ success: true });

        await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: endpoint.method
          })
        );

        // All debug endpoints should log their call
        expect(mockConsole.log).toHaveBeenCalledWith(
          expect.stringContaining('🔍 Debug')
        );
      }
    });

    it('should handle concurrent debug requests', async () => {
      mockSyncController.syncEvents.mockResolvedValue({ 
        success: true, 
        data: { usabmx: {}, uci: {}, errors: [] } 
      });
      mockSyncController.syncNews.mockResolvedValue({ 
        success: true, 
        data: { usabmx: {}, uci: {}, errors: [] } 
      });

      const requests = [
        app.handle(new Request('http://localhost/debug/sync-events', { method: 'POST' })),
        app.handle(new Request('http://localhost/debug/sync-news', { method: 'POST' }))
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockSyncController.syncEvents).toHaveBeenCalledTimes(1);
      expect(mockSyncController.syncNews).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid HTTP methods gracefully', async () => {
      const response = await app.handle(new Request('http://localhost/debug/scraper-health', {
        method: 'POST' // Invalid method for health endpoint
      }));

      expect(response.status).toBe(405); // Method not allowed
    });

    it('should provide detailed error information in debug mode', async () => {
      const detailedError = new Error('Detailed sync error with stack trace');
      mockSyncController.syncEvents.mockRejectedValue(detailedError);

      const response = await app.handle(new Request('http://localhost/debug/sync-events', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
      
      // Debug should log full error details
      expect(mockConsole.error).toHaveBeenCalledWith('🔍 Debug events error:', detailedError);
    });
  });

  describe('Performance and Monitoring', () => {
    it('should handle high-frequency debug requests', async () => {
      mockSyncController.checkScraperHealth.mockResolvedValue({ success: true });

      const requests = Array.from({ length: 10 }, () => 
        app.handle(new Request('http://localhost/debug/scraper-health'))
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockSyncController.checkScraperHealth).toHaveBeenCalledTimes(10);
      expect(mockConsole.log).toHaveBeenCalledTimes(20); // 2 logs per call
    });

    it('should provide timing information in logs', async () => {
      const syncData = {
        success: true,
        data: {
          usabmx: { processed: 10, added: 2, updated: 1, errors: [], duration: '1.2s' },
          uci: { processed: 5, added: 1, updated: 0, errors: [], duration: '0.8s' }
        }
      };

      mockSyncController.syncEvents.mockResolvedValue(syncData);

      const response = await app.handle(new Request('http://localhost/debug/sync-events', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.usabmx.duration).toBe('1.2s');
      expect(responseBody.data.uci.duration).toBe('0.8s');
    });
  });
});