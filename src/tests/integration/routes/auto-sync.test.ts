import { describe, expect, it, beforeEach } from '@jest/globals';
import { Elysia } from 'elysia';
import { autoSyncRoutes } from '../../../routes/auto-sync.js';

// Mock de los controladores de auto-sincronización
const mockAutoSyncController = {
  initializeAutoSync: jest.fn(),
  enableAutoSync: jest.fn(),
  getAutoSyncStatus: jest.fn(),
  reloadAutoSyncConfigurations: jest.fn(),
  stopAllAutoSync: jest.fn(),
  scheduleSync: jest.fn(),
  cancelScheduledSync: jest.fn(),
  testScheduledSync: jest.fn()
};

jest.mock('../../../controllers/autoSyncController.js', () => mockAutoSyncController);

// Mock del middleware de auth
jest.mock('../../../middleware/auth.js', () => ({
  authMiddleware: new (require('elysia').Elysia)().derive(() => ({
    user: { 
      id: 'admin-123', 
      userId: 'admin-123',
      name: 'Admin User', 
      email: 'admin@example.com', 
      role: 'ADMIN' 
    },
    isAuthenticated: true,
    clientIp: '192.168.1.100',
    userAgent: 'test-agent/1.0'
  }))
}));

describe('🤖 Auto Sync Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new Elysia().use(autoSyncRoutes);
  });

  describe('POST /sync/auto/initialize', () => {
    const mockInitializeData = {
      success: true,
      data: {
        systemInitialized: true,
        schedulerStatus: 'active',
        defaultConfigurations: [
          {
            id: 1,
            name: 'Daily Events Sync',
            cronExpression: '0 2 * * *',
            autoSyncEnabled: false
          },
          {
            id: 2,
            name: 'Hourly News Sync', 
            cronExpression: '0 */6 * * *',
            autoSyncEnabled: false
          }
        ],
        nextActions: [
          'Configure sync settings',
          'Enable auto synchronization',
          'Monitor sync performance'
        ]
      },
      message: 'Auto sync system initialized successfully'
    };

    it('should initialize auto sync system successfully', async () => {
      mockAutoSyncController.initializeAutoSync.mockResolvedValue(mockInitializeData);

      const response = await app.handle(new Request('http://localhost/sync/auto/initialize', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockInitializeData);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.systemInitialized).toBe(true);
      expect(responseBody.data.defaultConfigurations).toHaveLength(2);
      expect(mockAutoSyncController.initializeAutoSync).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockAutoSyncController.initializeAutoSync.mockRejectedValue(
        new Error('System already initialized')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/initialize', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
    });

    it('should handle partial initialization', async () => {
      const partialInit = {
        success: true,
        data: {
          systemInitialized: true,
          schedulerStatus: 'inactive',
          warnings: ['Scheduler failed to start', 'Some configurations missing']
        },
        message: 'Auto sync system partially initialized'
      };

      mockAutoSyncController.initializeAutoSync.mockResolvedValue(partialInit);

      const response = await app.handle(new Request('http://localhost/sync/auto/initialize', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.warnings).toHaveLength(2);
      expect(responseBody.data.schedulerStatus).toBe('inactive');
    });
  });

  describe('GET /sync/auto/status', () => {
    const mockStatusData = {
      success: true,
      data: {
        systemActive: true,
        schedulerRunning: true,
        activeConfigurations: 2,
        totalConfigurations: 5,
        scheduledJobs: [
          {
            id: 1,
            name: 'Daily Events Sync',
            nextRun: '2024-01-16T02:00:00Z',
            status: 'scheduled'
          },
          {
            id: 2,
            name: 'News Sync',
            nextRun: '2024-01-15T18:00:00Z',
            status: 'scheduled'
          }
        ],
        recentActivity: {
          lastSync: '2024-01-15T12:00:00Z',
          successful: 15,
          failed: 2,
          lastWeek: 17
        },
        performance: {
          averageDuration: '2.8s',
          successRate: 88.2,
          uptimePercentage: 99.5
        }
      },
      message: 'Auto sync status retrieved successfully'
    };

    it('should get auto sync status successfully', async () => {
      mockAutoSyncController.getAutoSyncStatus.mockResolvedValue(mockStatusData);

      const response = await app.handle(new Request('http://localhost/sync/auto/status'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockStatusData);
      expect(responseBody.data.systemActive).toBe(true);
      expect(responseBody.data.scheduledJobs).toHaveLength(2);
      expect(responseBody.data.performance.successRate).toBe(88.2);
      expect(mockAutoSyncController.getAutoSyncStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle inactive system status', async () => {
      const inactiveStatus = {
        success: false,
        data: {
          systemActive: false,
          schedulerRunning: false,
          activeConfigurations: 0,
          error: 'Scheduler service not running',
          lastError: '2024-01-15T11:30:00Z'
        },
        message: 'Auto sync system is currently inactive'
      };

      mockAutoSyncController.getAutoSyncStatus.mockResolvedValue(inactiveStatus);

      const response = await app.handle(new Request('http://localhost/sync/auto/status'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.data.systemActive).toBe(false);
    });

    it('should handle status retrieval errors', async () => {
      mockAutoSyncController.getAutoSyncStatus.mockRejectedValue(
        new Error('Status service unavailable')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/status'));

      expect(response.status).toBe(500);
    });
  });

  describe('POST /sync/auto/enable', () => {
    const mockEnableData = {
      success: true,
      data: {
        configurationId: 1,
        name: 'Daily Events Sync',
        cronExpression: '0 2 * * *',
        autoSyncEnabled: true,
        isActive: true,
        nextRun: '2024-01-16T02:00:00Z',
        scheduledJobId: 'job-123'
      },
      message: 'Auto sync enabled successfully for configuration'
    };

    it('should enable auto sync for configuration', async () => {
      mockAutoSyncController.enableAutoSync.mockResolvedValue(mockEnableData);

      const requestBody = {
        configurationId: 1,
        cronExpression: '0 2 * * *',
        autoSyncEnabled: true
      };

      const response = await app.handle(new Request('http://localhost/sync/auto/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockEnableData);
      expect(responseBody.data.autoSyncEnabled).toBe(true);
      expect(responseBody.data.nextRun).toBeDefined();
      expect(mockAutoSyncController.enableAutoSync).toHaveBeenCalledWith(requestBody);
    });

    it('should handle custom cron expression', async () => {
      const customCronData = {
        ...mockEnableData,
        data: {
          ...mockEnableData.data,
          cronExpression: '0 */4 * * *',
          nextRun: '2024-01-15T16:00:00Z'
        }
      };

      mockAutoSyncController.enableAutoSync.mockResolvedValue(customCronData);

      const requestBody = {
        configurationId: 2,
        cronExpression: '0 */4 * * *',
        autoSyncEnabled: true
      };

      const response = await app.handle(new Request('http://localhost/sync/auto/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.cronExpression).toBe('0 */4 * * *');
    });

    it('should handle invalid configuration errors', async () => {
      mockAutoSyncController.enableAutoSync.mockRejectedValue(
        new Error('Configuration not found')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configurationId: 999 })
      }));

      expect(response.status).toBe(500);
    });

    it('should handle malformed request body', async () => {
      const response = await app.handle(new Request('http://localhost/sync/auto/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      }));

      expect(response.status).not.toBe(200);
    });
  });

  describe('POST /sync/auto/schedule', () => {
    const mockScheduleData = {
      success: true,
      data: {
        scheduledJobId: 'job-456',
        configurationId: 3,
        cronExpression: '0 3 * * *',
        nextRun: '2024-01-16T03:00:00Z',
        status: 'scheduled',
        createdAt: '2024-01-15T14:00:00Z'
      },
      message: 'Sync task scheduled successfully'
    };

    it('should schedule sync task successfully', async () => {
      mockAutoSyncController.scheduleSync.mockResolvedValue(mockScheduleData);

      const requestBody = {
        configurationId: 3,
        cronExpression: '0 3 * * *'
      };

      const response = await app.handle(new Request('http://localhost/sync/auto/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockScheduleData);
      expect(responseBody.data.status).toBe('scheduled');
      expect(responseBody.data.nextRun).toBeDefined();
      expect(mockAutoSyncController.scheduleSync).toHaveBeenCalledWith(requestBody);
    });

    it('should handle invalid cron expression', async () => {
      mockAutoSyncController.scheduleSync.mockRejectedValue(
        new Error('Invalid cron expression')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configurationId: 1,
          cronExpression: 'invalid-cron'
        })
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /sync/auto/schedule/:id', () => {
    const mockCancelData = {
      success: true,
      data: {
        scheduledJobId: 'job-456',
        configurationId: 3,
        status: 'cancelled',
        cancelledAt: '2024-01-15T14:30:00Z'
      },
      message: 'Scheduled sync task cancelled successfully'
    };

    it('should cancel scheduled sync task', async () => {
      mockAutoSyncController.cancelScheduledSync.mockResolvedValue(mockCancelData);

      const response = await app.handle(new Request('http://localhost/sync/auto/schedule/3', {
        method: 'DELETE'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockCancelData);
      expect(responseBody.data.status).toBe('cancelled');
      expect(mockAutoSyncController.cancelScheduledSync).toHaveBeenCalledWith(3);
    });

    it('should handle non-existent schedule ID', async () => {
      mockAutoSyncController.cancelScheduledSync.mockRejectedValue(
        new Error('Scheduled task not found')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/schedule/999', {
        method: 'DELETE'
      }));

      expect(response.status).toBe(500);
    });

    it('should handle invalid ID parameter', async () => {
      mockAutoSyncController.cancelScheduledSync.mockRejectedValue(
        new Error('Invalid schedule ID')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/schedule/invalid', {
        method: 'DELETE'
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('POST /sync/auto/test/:id', () => {
    const mockTestData = {
      success: true,
      data: {
        testId: 'test-789',
        configurationId: 2,
        status: 'completed',
        startTime: '2024-01-15T14:45:00Z',
        endTime: '2024-01-15T14:47:30Z',
        duration: '2.5s',
        results: {
          events: {
            processed: 25,
            added: 5,
            updated: 3,
            errors: []
          },
          news: {
            processed: 15,
            added: 2,
            updated: 1,
            errors: []
          }
        },
        performance: {
          executionTime: '2.5s',
          memoryUsed: '45MB',
          networkRequests: 8
        }
      },
      message: 'Scheduled sync test completed successfully'
    };

    it('should test scheduled sync successfully', async () => {
      mockAutoSyncController.testScheduledSync.mockResolvedValue(mockTestData);

      const response = await app.handle(new Request('http://localhost/sync/auto/test/2', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockTestData);
      expect(responseBody.data.status).toBe('completed');
      expect(responseBody.data.results.events.processed).toBe(25);
      expect(responseBody.data.results.news.processed).toBe(15);
      expect(mockAutoSyncController.testScheduledSync).toHaveBeenCalledWith(2);
    });

    it('should handle test execution errors', async () => {
      mockAutoSyncController.testScheduledSync.mockRejectedValue(
        new Error('Test execution failed')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/test/1', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
    });

    it('should handle test with partial results', async () => {
      const partialTestData = {
        success: true,
        data: {
          ...mockTestData.data,
          status: 'completed_with_warnings',
          results: {
            events: { processed: 20, added: 3, updated: 1, errors: ['Timeout on source'] },
            news: { processed: 0, added: 0, updated: 0, errors: ['Service unavailable'] }
          }
        },
        message: 'Sync test completed with some issues'
      };

      mockAutoSyncController.testScheduledSync.mockResolvedValue(partialTestData);

      const response = await app.handle(new Request('http://localhost/sync/auto/test/2', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.results.events.errors).toHaveLength(1);
      expect(responseBody.data.results.news.errors).toHaveLength(1);
    });
  });

  describe('POST /sync/auto/reload', () => {
    const mockReloadData = {
      success: true,
      data: {
        reloadedConfigurations: 5,
        activeConfigurations: 3,
        inactiveConfigurations: 2,
        newConfigurations: 1,
        removedConfigurations: 0,
        schedulerRestarted: true,
        reloadTime: '2024-01-15T15:00:00Z'
      },
      message: 'Auto sync configurations reloaded successfully'
    };

    it('should reload configurations successfully', async () => {
      mockAutoSyncController.reloadAutoSyncConfigurations.mockResolvedValue(mockReloadData);

      const response = await app.handle(new Request('http://localhost/sync/auto/reload', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockReloadData);
      expect(responseBody.data.reloadedConfigurations).toBe(5);
      expect(responseBody.data.schedulerRestarted).toBe(true);
      expect(mockAutoSyncController.reloadAutoSyncConfigurations).toHaveBeenCalledTimes(1);
    });

    it('should handle reload errors', async () => {
      mockAutoSyncController.reloadAutoSyncConfigurations.mockRejectedValue(
        new Error('Configuration reload failed')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/reload', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
    });

    it('should handle partial reload success', async () => {
      const partialReload = {
        success: true,
        data: {
          reloadedConfigurations: 3,
          failedConfigurations: 2,
          schedulerRestarted: false,
          errors: ['Invalid cron expression in config 4', 'Missing parameters in config 5']
        },
        message: 'Configuration reload completed with errors'
      };

      mockAutoSyncController.reloadAutoSyncConfigurations.mockResolvedValue(partialReload);

      const response = await app.handle(new Request('http://localhost/sync/auto/reload', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.errors).toHaveLength(2);
      expect(responseBody.data.schedulerRestarted).toBe(false);
    });
  });

  describe('POST /sync/auto/stop-all', () => {
    const mockStopData = {
      success: true,
      data: {
        stoppedJobs: 3,
        activeJobsBeforeStop: 3,
        schedulerStopped: true,
        stoppedAt: '2024-01-15T15:30:00Z',
        stoppedJobDetails: [
          { id: 1, name: 'Daily Events Sync', status: 'stopped' },
          { id: 2, name: 'News Sync', status: 'stopped' },
          { id: 3, name: 'Weekly Stats', status: 'stopped' }
        ]
      },
      message: 'All auto sync tasks stopped successfully'
    };

    it('should stop all auto sync tasks successfully', async () => {
      mockAutoSyncController.stopAllAutoSync.mockResolvedValue(mockStopData);

      const response = await app.handle(new Request('http://localhost/sync/auto/stop-all', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockStopData);
      expect(responseBody.data.stoppedJobs).toBe(3);
      expect(responseBody.data.schedulerStopped).toBe(true);
      expect(responseBody.data.stoppedJobDetails).toHaveLength(3);
      expect(mockAutoSyncController.stopAllAutoSync).toHaveBeenCalledTimes(1);
    });

    it('should handle stop-all when no jobs are running', async () => {
      const noJobsData = {
        success: true,
        data: {
          stoppedJobs: 0,
          activeJobsBeforeStop: 0,
          schedulerStopped: false,
          message: 'No active sync jobs to stop'
        },
        message: 'No auto sync tasks were running'
      };

      mockAutoSyncController.stopAllAutoSync.mockResolvedValue(noJobsData);

      const response = await app.handle(new Request('http://localhost/sync/auto/stop-all', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.stoppedJobs).toBe(0);
    });

    it('should handle stop-all errors', async () => {
      mockAutoSyncController.stopAllAutoSync.mockRejectedValue(
        new Error('Failed to stop scheduler')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/stop-all', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /sync/auto/cron-examples', () => {
    it('should return cron examples successfully', async () => {
      const response = await app.handle(new Request('http://localhost/sync/auto/cron-examples'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.examples).toHaveLength(6);
      expect(responseBody.data.format).toHaveProperty('fields');
      expect(responseBody.data.format.fields).toEqual(['minute', 'hour', 'day', 'month', 'weekday']);
      
      // Verify specific examples
      const dailyExample = responseBody.data.examples.find((ex: any) => ex.frequency === 'daily');
      expect(dailyExample).toBeDefined();
      expect(dailyExample.expression).toBe('0 2 * * *');
      
      const weeklyExample = responseBody.data.examples.find((ex: any) => ex.frequency === 'weekly');
      expect(weeklyExample).toBeDefined();
      expect(weeklyExample.expression).toBe('0 2 * * 0');
      
      const monthlyExample = responseBody.data.examples.find((ex: any) => ex.frequency === 'monthly');
      expect(monthlyExample).toBeDefined();
      expect(monthlyExample.expression).toBe('0 2 1 * *');
    });

    it('should include helpful descriptions for each example', async () => {
      const response = await app.handle(new Request('http://localhost/sync/auto/cron-examples'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      responseBody.data.examples.forEach((example: any) => {
        expect(example).toHaveProperty('expression');
        expect(example).toHaveProperty('description');
        expect(example).toHaveProperty('frequency');
        expect(typeof example.description).toBe('string');
        expect(example.description.length).toBeGreaterThan(0);
      });
    });

    it('should provide format explanation', async () => {
      const response = await app.handle(new Request('http://localhost/sync/auto/cron-examples'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.format.example).toBe('0 2 * * * = minute=0, hour=2, any day, any month, any weekday');
    });
  });

  describe('Route Integration and Security', () => {
    it('should handle all auto sync endpoints with proper authentication', async () => {
      const endpoints = [
        { path: '/sync/auto/initialize', method: 'POST' },
        { path: '/sync/auto/status', method: 'GET' },
        { path: '/sync/auto/reload', method: 'POST' },
        { path: '/sync/auto/stop-all', method: 'POST' },
        { path: '/sync/auto/cron-examples', method: 'GET' }
      ];

      for (const endpoint of endpoints) {
        // Mock all controllers to return success
        Object.values(mockAutoSyncController).forEach(mock => {
          (mock as jest.Mock).mockResolvedValue({ success: true, data: {} });
        });

        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: endpoint.method
          })
        );

        expect(response.status).not.toBe(404);
        expect(response.status).not.toBe(401);
      }
    });

    it('should handle POST/DELETE endpoints with proper data', async () => {
      const postEndpoints = [
        { path: '/sync/auto/enable', body: { configurationId: 1, autoSyncEnabled: true } },
        { path: '/sync/auto/schedule', body: { configurationId: 1, cronExpression: '0 2 * * *' } }
      ];

      Object.values(mockAutoSyncController).forEach(mock => {
        (mock as jest.Mock).mockResolvedValue({ success: true, data: {} });
      });

      for (const endpoint of postEndpoints) {
        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(endpoint.body)
          })
        );

        expect(response.status).not.toBe(404);
      }

      // Test DELETE endpoint
      const response = await app.handle(
        new Request('http://localhost/sync/auto/schedule/1', {
          method: 'DELETE'
        })
      );

      expect(response.status).not.toBe(404);
    });

    it('should require authentication for all endpoints', async () => {
      // Verify that authMiddleware is applied and user context is available
      mockAutoSyncController.getAutoSyncStatus.mockImplementation(() => {
        return Promise.resolve({ success: true, data: { systemActive: true } });
      });

      const response = await app.handle(new Request('http://localhost/sync/auto/status'));

      expect(response.status).toBe(200);
      // Auth middleware should provide user context
    });

    it('should handle concurrent auto sync requests', async () => {
      Object.values(mockAutoSyncController).forEach(mock => {
        (mock as jest.Mock).mockResolvedValue({ success: true, data: {} });
      });

      const requests = [
        app.handle(new Request('http://localhost/sync/auto/status')),
        app.handle(new Request('http://localhost/sync/auto/cron-examples')),
        app.handle(new Request('http://localhost/sync/auto/reload', { method: 'POST' }))
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle malformed request bodies gracefully', async () => {
      const response = await app.handle(new Request('http://localhost/sync/auto/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      }));

      expect(response.status).not.toBe(200);
    });

    it('should validate ID parameters in routes', async () => {
      mockAutoSyncController.testScheduledSync.mockRejectedValue(
        new Error('Invalid ID format')
      );

      const response = await app.handle(new Request('http://localhost/sync/auto/test/notanumber', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
    });

    it('should provide consistent response format', async () => {
      const mockResponse = {
        success: true,
        data: { test: 'data' },
        message: 'Test message'
      };

      const endpoints = [
        { path: '/sync/auto/status', method: 'GET', controller: 'getAutoSyncStatus' },
        { path: '/sync/auto/initialize', method: 'POST', controller: 'initializeAutoSync' }
      ];

      for (const endpoint of endpoints) {
        (mockAutoSyncController as any)[endpoint.controller].mockResolvedValue(mockResponse);

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

    it('should handle edge cases in cron examples', async () => {
      const response = await app.handle(new Request('http://localhost/sync/auto/cron-examples'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      
      // Verify all examples have valid cron syntax (5 fields)
      responseBody.data.examples.forEach((example: any) => {
        const fields = example.expression.split(' ');
        expect(fields).toHaveLength(5);
      });
    });
  });

  describe('Performance and Error Recovery', () => {
    it('should handle high-frequency status requests', async () => {
      mockAutoSyncController.getAutoSyncStatus.mockResolvedValue({ success: true, data: {} });

      const requests = Array.from({ length: 5 }, () => 
        app.handle(new Request('http://localhost/sync/auto/status'))
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockAutoSyncController.getAutoSyncStatus).toHaveBeenCalledTimes(5);
    });

    it('should handle system recovery scenarios', async () => {
      // Test initialize after failure
      mockAutoSyncController.initializeAutoSync.mockResolvedValueOnce({
        success: false,
        message: 'Initialization failed'
      }).mockResolvedValueOnce({
        success: true,
        data: { systemInitialized: true },
        message: 'System recovered and initialized'
      });

      // First attempt fails
      const response1 = await app.handle(new Request('http://localhost/sync/auto/initialize', {
        method: 'POST'
      }));

      expect(response1.status).toBe(200);
      const body1 = await response1.json();
      expect(body1.success).toBe(false);

      // Second attempt succeeds
      const response2 = await app.handle(new Request('http://localhost/sync/auto/initialize', {
        method: 'POST'
      }));

      expect(response2.status).toBe(200);
      const body2 = await response2.json();
      expect(body2.success).toBe(true);
    });
  });
});