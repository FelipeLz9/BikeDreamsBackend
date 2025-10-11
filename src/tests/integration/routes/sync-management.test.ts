import { describe, expect, it, beforeEach } from '@jest/globals';
import { Elysia } from 'elysia';
import { syncManagementRoutes } from '../../../routes/sync-management.js';

// Mock de los controladores de gestión de sincronización
const mockSyncManagementController = {
  executeAdvancedSync: jest.fn(),
  getSyncStatistics: jest.fn(),
  getSyncLogs: jest.fn(),
  getSyncConfigurations: jest.fn(),
  upsertSyncConfiguration: jest.fn(),
  toggleSyncConfiguration: jest.fn(),
  getActiveConfiguration: jest.fn(),
  getSyncDashboard: jest.fn()
};

jest.mock('../../../controllers/syncManagementController.js', () => mockSyncManagementController);

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

describe('⚙️ Sync Management Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new Elysia().use(syncManagementRoutes);
  });

  describe('GET /sync/management/dashboard', () => {
    const mockDashboardData = {
      success: true,
      data: {
        overview: {
          totalSyncs: 150,
          successfulSyncs: 142,
          failedSyncs: 8,
          averageDuration: '2.4s'
        },
        recentActivity: [
          { id: 1, type: 'events', status: 'success', timestamp: '2024-01-15T10:30:00Z' },
          { id: 2, type: 'news', status: 'success', timestamp: '2024-01-15T10:25:00Z' }
        ],
        configurations: {
          total: 3,
          active: 1,
          scheduled: 2
        },
        systemHealth: {
          scraperStatus: 'healthy',
          databaseConnections: 'optimal',
          queueSize: 0
        }
      },
      message: 'Sync dashboard data retrieved successfully'
    };

    it('should get dashboard data successfully', async () => {
      mockSyncManagementController.getSyncDashboard.mockResolvedValue(mockDashboardData);

      const response = await app.handle(new Request('http://localhost/sync/management/dashboard'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockDashboardData);
      expect(responseBody.data.overview.totalSyncs).toBe(150);
      expect(responseBody.data.systemHealth.scraperStatus).toBe('healthy');
      expect(mockSyncManagementController.getSyncDashboard).toHaveBeenCalledTimes(1);
    });

    it('should handle dashboard errors', async () => {
      mockSyncManagementController.getSyncDashboard.mockRejectedValue(
        new Error('Dashboard data unavailable')
      );

      const response = await app.handle(new Request('http://localhost/sync/management/dashboard'));

      expect(response.status).toBe(500);
    });
  });

  describe('POST /sync/management/execute', () => {
    const mockExecuteData = {
      success: true,
      data: {
        syncId: 'sync-456',
        type: 'events',
        status: 'completed',
        startTime: '2024-01-15T11:00:00Z',
        endTime: '2024-01-15T11:02:30Z',
        duration: '2.5s',
        results: {
          processed: 45,
          added: 12,
          updated: 8,
          errors: []
        }
      },
      message: 'Advanced sync executed successfully'
    };

    it('should execute sync with type successfully', async () => {
      mockSyncManagementController.executeAdvancedSync.mockResolvedValue(mockExecuteData);

      const response = await app.handle(new Request('http://localhost/sync/management/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'events' })
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockExecuteData);
      expect(responseBody.data.type).toBe('events');
      expect(mockSyncManagementController.executeAdvancedSync).toHaveBeenCalledWith('events', 'admin-123');
    });

    it('should execute sync without type', async () => {
      mockSyncManagementController.executeAdvancedSync.mockResolvedValue(mockExecuteData);

      const response = await app.handle(new Request('http://localhost/sync/management/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }));

      expect(response.status).toBe(200);
      
      expect(mockSyncManagementController.executeAdvancedSync).toHaveBeenCalledWith(undefined, 'admin-123');
    });

    it('should handle sync execution errors', async () => {
      mockSyncManagementController.executeAdvancedSync.mockRejectedValue(
        new Error('Sync execution failed')
      );

      const response = await app.handle(new Request('http://localhost/sync/management/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'all' })
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /sync/management/statistics', () => {
    const mockStatisticsData = {
      success: true,
      data: {
        totalSyncs: 150,
        successful: 142,
        failed: 8,
        avgDuration: 2.4,
        byType: {
          events: { total: 75, successful: 72, failed: 3 },
          news: { total: 50, successful: 48, failed: 2 },
          all: { total: 25, successful: 22, failed: 3 }
        },
        timeline: [
          { date: '2024-01-14', successful: 15, failed: 1 },
          { date: '2024-01-15', successful: 18, failed: 0 }
        ]
      },
      message: 'Sync statistics retrieved successfully'
    };

    it('should get statistics without date filter', async () => {
      mockSyncManagementController.getSyncStatistics.mockResolvedValue(mockStatisticsData);

      const response = await app.handle(new Request('http://localhost/sync/management/statistics'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockStatisticsData);
      expect(mockSyncManagementController.getSyncStatistics).toHaveBeenCalledWith(undefined);
    });

    it('should get statistics with date filter', async () => {
      mockSyncManagementController.getSyncStatistics.mockResolvedValue(mockStatisticsData);

      const response = await app.handle(new Request('http://localhost/sync/management/statistics?days=7'));

      expect(response.status).toBe(200);
      
      expect(mockSyncManagementController.getSyncStatistics).toHaveBeenCalledWith(7);
    });

    it('should handle invalid days parameter', async () => {
      mockSyncManagementController.getSyncStatistics.mockResolvedValue(mockStatisticsData);

      const response = await app.handle(new Request('http://localhost/sync/management/statistics?days=invalid'));

      expect(response.status).toBe(200);
      
      expect(mockSyncManagementController.getSyncStatistics).toHaveBeenCalledWith(undefined);
    });
  });

  describe('GET /sync/management/logs', () => {
    const mockLogsData = {
      success: true,
      data: {
        logs: [
          {
            id: 1,
            type: 'events',
            status: 'success',
            message: 'Sync completed successfully',
            timestamp: '2024-01-15T10:30:00Z',
            duration: 2.5
          },
          {
            id: 2,
            type: 'news',
            status: 'error',
            message: 'Connection timeout',
            timestamp: '2024-01-15T10:25:00Z',
            duration: 0
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 150,
          totalPages: 8
        }
      },
      message: 'Sync logs retrieved successfully'
    };

    it('should get logs without filters', async () => {
      mockSyncManagementController.getSyncLogs.mockResolvedValue(mockLogsData);

      const response = await app.handle(new Request('http://localhost/sync/management/logs'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockLogsData);
      expect(responseBody.data.logs).toHaveLength(2);
      expect(mockSyncManagementController.getSyncLogs).toHaveBeenCalledWith(undefined, undefined, undefined);
    });

    it('should get logs with pagination and status filter', async () => {
      mockSyncManagementController.getSyncLogs.mockResolvedValue(mockLogsData);

      const response = await app.handle(new Request('http://localhost/sync/management/logs?page=2&limit=10&status=success'));

      expect(response.status).toBe(200);
      
      expect(mockSyncManagementController.getSyncLogs).toHaveBeenCalledWith(2, 10, 'success');
    });

    it('should handle invalid pagination parameters', async () => {
      mockSyncManagementController.getSyncLogs.mockResolvedValue(mockLogsData);

      const response = await app.handle(new Request('http://localhost/sync/management/logs?page=invalid&limit=invalid'));

      expect(response.status).toBe(200);
      
      expect(mockSyncManagementController.getSyncLogs).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
  });

  describe('GET /sync/management/configurations', () => {
    const mockConfigurationsData = {
      success: true,
      data: {
        configurations: [
          {
            id: 1,
            name: 'Daily Events Sync',
            cronExpression: '0 2 * * *',
            autoSyncEnabled: true,
            isActive: true,
            lastRun: '2024-01-15T02:00:00Z'
          },
          {
            id: 2,
            name: 'Hourly News Sync',
            cronExpression: '0 */6 * * *',
            autoSyncEnabled: false,
            isActive: false,
            lastRun: null
          }
        ],
        total: 2
      },
      message: 'Sync configurations retrieved successfully'
    };

    it('should get all configurations', async () => {
      mockSyncManagementController.getSyncConfigurations.mockResolvedValue(mockConfigurationsData);

      const response = await app.handle(new Request('http://localhost/sync/management/configurations'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockConfigurationsData);
      expect(responseBody.data.configurations).toHaveLength(2);
      expect(responseBody.data.total).toBe(2);
      expect(mockSyncManagementController.getSyncConfigurations).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /sync/management/configurations/active', () => {
    const mockActiveConfigData = {
      success: true,
      data: {
        id: 1,
        name: 'Daily Events Sync',
        cronExpression: '0 2 * * *',
        autoSyncEnabled: true,
        isActive: true,
        lastRun: '2024-01-15T02:00:00Z',
        nextRun: '2024-01-16T02:00:00Z'
      },
      message: 'Active configuration retrieved successfully'
    };

    it('should get active configuration', async () => {
      mockSyncManagementController.getActiveConfiguration.mockResolvedValue(mockActiveConfigData);

      const response = await app.handle(new Request('http://localhost/sync/management/configurations/active'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockActiveConfigData);
      expect(responseBody.data.isActive).toBe(true);
      expect(mockSyncManagementController.getActiveConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should handle no active configuration', async () => {
      const noActiveConfig = {
        success: false,
        data: null,
        message: 'No active configuration found'
      };

      mockSyncManagementController.getActiveConfiguration.mockResolvedValue(noActiveConfig);

      const response = await app.handle(new Request('http://localhost/sync/management/configurations/active'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.data).toBeNull();
    });
  });

  describe('POST /sync/management/configurations', () => {
    const mockConfigurationData = {
      name: 'New Sync Config',
      cronExpression: '0 4 * * *',
      autoSyncEnabled: true,
      syncTypes: ['events', 'news']
    };

    const mockCreatedConfig = {
      success: true,
      data: {
        id: 3,
        ...mockConfigurationData,
        createdBy: 'admin-123',
        isActive: false,
        createdAt: '2024-01-15T12:00:00Z'
      },
      message: 'Sync configuration created successfully'
    };

    it('should create new configuration', async () => {
      mockSyncManagementController.upsertSyncConfiguration.mockResolvedValue(mockCreatedConfig);

      const response = await app.handle(new Request('http://localhost/sync/management/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockConfigurationData)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockCreatedConfig);
      expect(responseBody.data.createdBy).toBe('admin-123');
      expect(mockSyncManagementController.upsertSyncConfiguration).toHaveBeenCalledWith({
        ...mockConfigurationData,
        createdBy: 'admin-123'
      });
    });

    it('should handle configuration creation errors', async () => {
      mockSyncManagementController.upsertSyncConfiguration.mockRejectedValue(
        new Error('Invalid cron expression')
      );

      const response = await app.handle(new Request('http://localhost/sync/management/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mockConfigurationData, cronExpression: 'invalid' })
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /sync/management/configurations/:id/toggle', () => {
    const mockToggleResponse = {
      success: true,
      data: {
        id: 1,
        name: 'Daily Events Sync',
        isActive: false,
        updatedAt: '2024-01-15T12:30:00Z'
      },
      message: 'Configuration toggled successfully'
    };

    it('should toggle configuration status', async () => {
      mockSyncManagementController.toggleSyncConfiguration.mockResolvedValue(mockToggleResponse);

      const response = await app.handle(new Request('http://localhost/sync/management/configurations/1/toggle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockToggleResponse);
      expect(responseBody.data.isActive).toBe(false);
      expect(mockSyncManagementController.toggleSyncConfiguration).toHaveBeenCalledWith(1, false);
    });

    it('should handle invalid configuration ID', async () => {
      mockSyncManagementController.toggleSyncConfiguration.mockRejectedValue(
        new Error('Configuration not found')
      );

      const response = await app.handle(new Request('http://localhost/sync/management/configurations/999/toggle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /sync/management/status', () => {
    it('should get system status successfully', async () => {
      const mockActiveConfig = {
        success: true,
        data: {
          autoSyncEnabled: true,
          isActive: true
        }
      };

      const mockRecentStats = {
        success: true,
        data: {
          successful: 5,
          totalSyncs: 8
        }
      };

      mockSyncManagementController.getActiveConfiguration.mockResolvedValue(mockActiveConfig);
      mockSyncManagementController.getSyncStatistics.mockResolvedValue(mockRecentStats);

      const response = await app.handle(new Request('http://localhost/sync/management/status'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.autoSyncEnabled).toBe(true);
      expect(responseBody.data.hasActiveConfiguration).toBe(true);
      expect(responseBody.data.lastSyncSuccess).toBe(true);
      expect(responseBody.data.totalSyncsToday).toBe(8);
      expect(responseBody.data.systemHealthy).toBe(true);
    });

    it('should handle status errors gracefully', async () => {
      mockSyncManagementController.getActiveConfiguration.mockRejectedValue(
        new Error('Database error')
      );

      const response = await app.handle(new Request('http://localhost/sync/management/status'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.data.systemHealthy).toBe(false);
      expect(responseBody.data.autoSyncEnabled).toBe(false);
    });

    it('should handle no active configuration', async () => {
      const mockNoActiveConfig = {
        success: false,
        data: null
      };

      const mockNoStats = {
        success: true,
        data: {
          successful: 0,
          totalSyncs: 0
        }
      };

      mockSyncManagementController.getActiveConfiguration.mockResolvedValue(mockNoActiveConfig);
      mockSyncManagementController.getSyncStatistics.mockResolvedValue(mockNoStats);

      const response = await app.handle(new Request('http://localhost/sync/management/status'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.autoSyncEnabled).toBe(false);
      expect(responseBody.data.hasActiveConfiguration).toBe(false);
      expect(responseBody.data.lastSyncSuccess).toBe(false);
    });
  });

  describe('Route Integration and Security', () => {
    it('should handle all management endpoints with proper authentication', async () => {
      const endpoints = [
        { path: '/sync/management/dashboard', method: 'GET' },
        { path: '/sync/management/statistics', method: 'GET' },
        { path: '/sync/management/logs', method: 'GET' },
        { path: '/sync/management/configurations', method: 'GET' },
        { path: '/sync/management/configurations/active', method: 'GET' },
        { path: '/sync/management/status', method: 'GET' }
      ];

      for (const endpoint of endpoints) {
        // Mock all controllers to return success
        Object.values(mockSyncManagementController).forEach(mock => {
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

    it('should handle POST/PUT endpoints with request bodies', async () => {
      const postEndpoints = [
        { path: '/sync/management/execute', body: { syncType: 'events' } },
        { path: '/sync/management/configurations', body: { name: 'Test Config' } }
      ];

      const putEndpoints = [
        { path: '/sync/management/configurations/1/toggle', body: { isActive: true } }
      ];

      Object.values(mockSyncManagementController).forEach(mock => {
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

      for (const endpoint of putEndpoints) {
        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(endpoint.body)
          })
        );

        expect(response.status).not.toBe(404);
      }
    });

    it('should provide user context to controllers', async () => {
      mockSyncManagementController.executeAdvancedSync.mockImplementation((syncType, userId) => {
        expect(userId).toBe('admin-123');
        return Promise.resolve({ success: true, data: {} });
      });

      const response = await app.handle(new Request('http://localhost/sync/management/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'events' })
      }));

      expect(response.status).toBe(200);
    });

    it('should handle malformed request bodies gracefully', async () => {
      const response = await app.handle(new Request('http://localhost/sync/management/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      }));

      expect(response.status).not.toBe(200);
    });

    it('should handle concurrent management requests', async () => {
      Object.values(mockSyncManagementController).forEach(mock => {
        (mock as jest.Mock).mockResolvedValue({ success: true, data: {} });
      });

      const requests = [
        app.handle(new Request('http://localhost/sync/management/dashboard')),
        app.handle(new Request('http://localhost/sync/management/statistics')),
        app.handle(new Request('http://localhost/sync/management/configurations'))
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});