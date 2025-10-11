// Mock de PrismaClient
const mockPrismaClient = {
  syncLog: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  syncConfiguration: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  syncSchedule: {
    upsert: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock del scraperIntegrationService
const mockScraperIntegrationService = {
  syncEvents: jest.fn(),
  syncNews: jest.fn(),
  syncAll: jest.fn(),
  checkScraperHealth: jest.fn(),
};

jest.mock('../../services/scraperIntegration.js', () => ({
  scraperIntegrationService: mockScraperIntegrationService,
}));

// Mock de console para evitar spam en tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

import { syncManagerService } from '../../services/syncManager';

describe('🔄 SyncManager Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('executeSyncWithLogging', () => {
    it('should execute events sync successfully', async () => {
      // Mock data
      const mockSyncLog = { id: 1 };
      const mockEventsResult = {
        success: true,
        usabmx: 5,
        uci: 3,
        errors: []
      };

      // Setup mocks
      mockPrismaClient.syncLog.create.mockResolvedValue(mockSyncLog);
      mockPrismaClient.syncLog.update.mockResolvedValue({});
      mockScraperIntegrationService.checkScraperHealth.mockResolvedValue({ isHealthy: true });
      mockScraperIntegrationService.syncEvents.mockResolvedValue(mockEventsResult);

      const result = await syncManagerService.executeSyncWithLogging('events', 'manual', 1);

      expect(result.success).toBe(true);
      expect(result.logId).toBe(1);
      expect(result.result?.events.usabmx).toBe(5);
      expect(result.result?.events.uci).toBe(3);

      // Verify sync log creation
      expect(mockPrismaClient.syncLog.create).toHaveBeenCalledWith({
        data: {
          syncType: 'events',
          triggerType: 'manual',
          status: 'running',
          triggeredBy: 1,
          configurationId: undefined,
          scraperHealth: true
        }
      });

      // Verify sync log completion update
      expect(mockPrismaClient.syncLog.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
          durationMs: expect.any(Number),
          eventsUsabmx: 5,
          eventsUci: 3,
          newsUsabmx: 0,
          newsUci: 0,
          eventsSynced: 8,
          newsSynced: 0,
          totalErrors: 0,
          errorDetails: []
        })
      });
    });

    it('should execute news sync successfully', async () => {
      const mockSyncLog = { id: 2 };
      const mockNewsResult = {
        success: true,
        usabmx: 4,
        uci: 2,
        errors: ['Minor warning']
      };

      mockPrismaClient.syncLog.create.mockResolvedValue(mockSyncLog);
      mockPrismaClient.syncLog.update.mockResolvedValue({});
      mockScraperIntegrationService.checkScraperHealth.mockResolvedValue({ isHealthy: true });
      mockScraperIntegrationService.syncNews.mockResolvedValue(mockNewsResult);

      const result = await syncManagerService.executeSyncWithLogging('news', 'scheduled', 2, 10);

      expect(result.success).toBe(true);
      expect(result.logId).toBe(2);
      expect(result.result?.news.usabmx).toBe(4);
      expect(result.result?.news.uci).toBe(2);
      expect(result.result?.errors).toContain('Minor warning');

      // Verify correct configuration was passed
      expect(mockPrismaClient.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          syncType: 'news',
          triggerType: 'scheduled',
          triggeredBy: 2,
          configurationId: 10
        })
      });
    });

    it('should execute full sync (default case)', async () => {
      const mockSyncLog = { id: 3 };
      const mockSyncAllResult = {
        success: true,
        events: { usabmx: 10, uci: 8 },
        news: { usabmx: 5, uci: 3 },
        errors: []
      };

      mockPrismaClient.syncLog.create.mockResolvedValue(mockSyncLog);
      mockPrismaClient.syncLog.update.mockResolvedValue({});
      mockScraperIntegrationService.checkScraperHealth.mockResolvedValue({ isHealthy: true });
      mockScraperIntegrationService.syncAll.mockResolvedValue(mockSyncAllResult);

      const result = await syncManagerService.executeSyncWithLogging();

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockSyncAllResult);
      expect(mockScraperIntegrationService.syncAll).toHaveBeenCalled();
    });

    it('should handle sync failure and log error', async () => {
      const mockSyncLog = { id: 4 };
      const syncError = new Error('Sync failed');

      mockPrismaClient.syncLog.create.mockResolvedValue(mockSyncLog);
      mockPrismaClient.syncLog.update.mockResolvedValue({});
      mockScraperIntegrationService.checkScraperHealth.mockResolvedValue({ isHealthy: false });
      mockScraperIntegrationService.syncAll.mockRejectedValue(syncError);

      const result = await syncManagerService.executeSyncWithLogging();

      expect(result.success).toBe(false);
      expect(result.logId).toBe(4);
      expect(result.result).toBeUndefined();

      // Verify error logging
      expect(mockPrismaClient.syncLog.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: expect.objectContaining({
          status: 'failed',
          completedAt: expect.any(Date),
          durationMs: expect.any(Number),
          totalErrors: 1,
          errorDetails: ['Error: Sync failed']
        })
      });
    });

    it('should handle failed sync result correctly', async () => {
      const mockSyncLog = { id: 5 };
      const failedResult = {
        success: false,
        events: { usabmx: 0, uci: 0 },
        news: { usabmx: 0, uci: 0 },
        errors: ['API timeout', 'Connection failed']
      };

      mockPrismaClient.syncLog.create.mockResolvedValue(mockSyncLog);
      mockPrismaClient.syncLog.update.mockResolvedValue({});
      mockScraperIntegrationService.checkScraperHealth.mockResolvedValue({ isHealthy: true });
      mockScraperIntegrationService.syncAll.mockResolvedValue(failedResult);

      const result = await syncManagerService.executeSyncWithLogging();

      expect(result.success).toBe(false);
      expect(result.result?.errors).toHaveLength(2);

      expect(mockPrismaClient.syncLog.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({
          status: 'failed',
          totalErrors: 2,
          errorDetails: ['API timeout', 'Connection failed']
        })
      });
    });
  });

  describe('getActiveConfiguration', () => {
    it('should return active configuration with schedule', async () => {
      const mockConfiguration = {
        id: 1,
        name: 'Daily Sync',
        isActive: true,
        autoSyncEnabled: true,
        schedule: {
          cronExpression: '0 2 * * *',
          nextRun: new Date()
        }
      };

      mockPrismaClient.syncConfiguration.findFirst.mockResolvedValue(mockConfiguration);

      const result = await syncManagerService.getActiveConfiguration();

      expect(result).toEqual(mockConfiguration);
      expect(mockPrismaClient.syncConfiguration.findFirst).toHaveBeenCalledWith({
        where: {
          isActive: true,
          autoSyncEnabled: true
        },
        include: {
          schedule: true
        }
      });
    });

    it('should return null when no active configuration exists', async () => {
      mockPrismaClient.syncConfiguration.findFirst.mockResolvedValue(null);

      const result = await syncManagerService.getActiveConfiguration();

      expect(result).toBeNull();
    });
  });

  describe('upsertConfiguration', () => {
    it('should create new configuration with all defaults', async () => {
      const configData = {
        name: 'Test Config',
        description: 'Test configuration',
        createdBy: 1
      };

      const mockCreatedConfig = {
        id: 1,
        name: 'Test Config',
        description: 'Test configuration',
        syncFrequency: 'daily',
        syncTime: '02:00',
        syncEvents: true,
        syncNews: true,
        syncUsabmx: true,
        syncUci: true,
        autoSyncEnabled: false,
        notificationsEnabled: true,
        maxRetries: 3,
        timeoutMinutes: 30,
        createdBy: 1
      };

      mockPrismaClient.syncConfiguration.upsert.mockResolvedValue(mockCreatedConfig);

      const result = await syncManagerService.upsertConfiguration(configData);

      expect(result).toEqual(mockCreatedConfig);
      expect(mockPrismaClient.syncConfiguration.upsert).toHaveBeenCalledWith({
        where: { name: 'Test Config' },
        create: expect.objectContaining({
          name: 'Test Config',
          description: 'Test configuration',
          syncFrequency: 'daily',
          syncTime: '02:00',
          syncEvents: true,
          syncNews: true,
          syncUsabmx: true,
          syncUci: true,
          autoSyncEnabled: false,
          notificationsEnabled: true,
          maxRetries: 3,
          timeoutMinutes: 30,
          createdBy: 1
        }),
        update: expect.any(Object)
      });
    });

    it('should update existing configuration', async () => {
      const configData = {
        name: 'Existing Config',
        syncFrequency: 'weekly',
        autoSyncEnabled: true,
        maxRetries: 5
      };

      const mockUpdatedConfig = { id: 2, name: 'Existing Config', ...configData };

      mockPrismaClient.syncConfiguration.upsert.mockResolvedValue(mockUpdatedConfig);

      const result = await syncManagerService.upsertConfiguration(configData);

      expect(result.syncFrequency).toBe('weekly');
      expect(result.autoSyncEnabled).toBe(true);
      expect(result.maxRetries).toBe(5);

      expect(mockPrismaClient.syncConfiguration.upsert).toHaveBeenCalledWith({
        where: { name: 'Existing Config' },
        create: expect.any(Object),
        update: expect.objectContaining({
          syncFrequency: 'weekly',
          autoSyncEnabled: true,
          maxRetries: 5,
          updatedAt: expect.any(Date)
        })
      });
    });

    it('should create schedule when cronExpression is provided', async () => {
      const configData = {
        name: 'Scheduled Config',
        cronExpression: '0 2 * * *'
      };

      const mockConfig = { id: 3, name: 'Scheduled Config' };
      const mockSchedule = {
        configurationId: 3,
        cronExpression: '0 2 * * *',
        nextRun: expect.any(Date)
      };

      mockPrismaClient.syncConfiguration.upsert.mockResolvedValue(mockConfig);
      mockPrismaClient.syncSchedule.upsert.mockResolvedValue(mockSchedule);

      const result = await syncManagerService.upsertConfiguration(configData);

      expect(mockPrismaClient.syncSchedule.upsert).toHaveBeenCalledWith({
        where: { configurationId: 3 },
        create: expect.objectContaining({
          configurationId: 3,
          cronExpression: '0 2 * * *',
          nextRun: expect.any(Date)
        }),
        update: expect.objectContaining({
          cronExpression: '0 2 * * *',
          nextRun: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      });
    });
  });

  describe('getSyncStatistics', () => {
    it('should calculate statistics correctly', async () => {
      const mockLogs = [
        {
          id: 1,
          status: 'completed',
          eventsSynced: 10,
          newsSynced: 5,
          durationMs: 1000,
          startedAt: new Date()
        },
        {
          id: 2,
          status: 'completed',
          eventsSynced: 8,
          newsSynced: 3,
          durationMs: 1500,
          startedAt: new Date()
        },
        {
          id: 3,
          status: 'failed',
          eventsSynced: 0,
          newsSynced: 0,
          durationMs: 500,
          startedAt: new Date()
        }
      ];

      mockPrismaClient.syncLog.findMany.mockResolvedValue(mockLogs);

      const result = await syncManagerService.getSyncStatistics(30);

      expect(result).toEqual({
        period: 'Last 30 days',
        totalSyncs: 3,
        successful: 2,
        failed: 1,
        successRate: expect.closeTo(66.67, 2),
        totalEvents: 18,
        totalNews: 8,
        averageDurationMs: 1000, // (1000 + 1500 + 500) / 3
        recentLogs: mockLogs
      });

      expect(mockPrismaClient.syncLog.findMany).toHaveBeenCalledWith({
        where: {
          startedAt: {
            gte: expect.any(Date)
          }
        },
        orderBy: {
          startedAt: 'desc'
        }
      });
    });

    it('should handle empty logs gracefully', async () => {
      mockPrismaClient.syncLog.findMany.mockResolvedValue([]);

      const result = await syncManagerService.getSyncStatistics(7);

      expect(result).toEqual({
        period: 'Last 7 days',
        totalSyncs: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        totalEvents: 0,
        totalNews: 0,
        averageDurationMs: 0,
        recentLogs: []
      });
    });

    it('should handle logs without duration gracefully', async () => {
      const mockLogs = [
        {
          id: 1,
          status: 'completed',
          eventsSynced: 5,
          newsSynced: 2,
          durationMs: null,
          startedAt: new Date()
        },
        {
          id: 2,
          status: 'completed',
          eventsSynced: 3,
          newsSynced: 1,
          durationMs: 2000,
          startedAt: new Date()
        }
      ];

      mockPrismaClient.syncLog.findMany.mockResolvedValue(mockLogs);

      const result = await syncManagerService.getSyncStatistics();

      expect(result.totalSyncs).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.averageDurationMs).toBe(2000); // Only counts logs with durationMs
    });
  });

  describe('getSyncLogs', () => {
    it('should return paginated logs with configuration names', async () => {
      const mockLogs = [
        {
          id: 1,
          status: 'completed',
          startedAt: new Date(),
          configuration: { name: 'Daily Sync' }
        },
        {
          id: 2,
          status: 'failed',
          startedAt: new Date(),
          configuration: { name: 'Weekly Sync' }
        }
      ];

      mockPrismaClient.syncLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaClient.syncLog.count.mockResolvedValue(25);

      const result = await syncManagerService.getSyncLogs(2, 10, 'completed');

      expect(result).toEqual({
        logs: mockLogs,
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          pages: 3
        }
      });

      expect(mockPrismaClient.syncLog.findMany).toHaveBeenCalledWith({
        where: { status: 'completed' },
        skip: 10, // (page - 1) * limit
        take: 10,
        orderBy: { startedAt: 'desc' },
        include: {
          configuration: {
            select: { name: true }
          }
        }
      });
    });

    it('should return logs without status filter', async () => {
      const mockLogs = [{ id: 1, status: 'running' }];
      mockPrismaClient.syncLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaClient.syncLog.count.mockResolvedValue(1);

      await syncManagerService.getSyncLogs(1, 20);

      expect(mockPrismaClient.syncLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          configuration: {
            select: { name: true }
          }
        }
      });
    });
  });

  describe('getConfigurations', () => {
    it('should return all configurations with schedules and log counts', async () => {
      const mockConfigurations = [
        {
          id: 1,
          name: 'Config 1',
          schedule: { cronExpression: '0 2 * * *' },
          _count: { logs: 10 }
        },
        {
          id: 2,
          name: 'Config 2',
          schedule: null,
          _count: { logs: 5 }
        }
      ];

      mockPrismaClient.syncConfiguration.findMany.mockResolvedValue(mockConfigurations);

      const result = await syncManagerService.getConfigurations();

      expect(result).toEqual(mockConfigurations);
      expect(mockPrismaClient.syncConfiguration.findMany).toHaveBeenCalledWith({
        include: {
          schedule: true,
          _count: {
            select: { logs: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('toggleConfiguration', () => {
    it('should activate configuration', async () => {
      const mockUpdatedConfig = { id: 1, name: 'Test Config', isActive: true };
      mockPrismaClient.syncConfiguration.update.mockResolvedValue(mockUpdatedConfig);

      const result = await syncManagerService.toggleConfiguration(1, true);

      expect(result).toEqual(mockUpdatedConfig);
      expect(mockPrismaClient.syncConfiguration.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          isActive: true,
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should deactivate configuration', async () => {
      const mockUpdatedConfig = { id: 2, name: 'Test Config', isActive: false };
      mockPrismaClient.syncConfiguration.update.mockResolvedValue(mockUpdatedConfig);

      const result = await syncManagerService.toggleConfiguration(2, false);

      expect(result.isActive).toBe(false);
    });
  });

  describe('checkScraperHealth (private method through executeSyncWithLogging)', () => {
    it('should return true when scraper is healthy', async () => {
      const mockSyncLog = { id: 1 };
      mockPrismaClient.syncLog.create.mockResolvedValue(mockSyncLog);
      mockPrismaClient.syncLog.update.mockResolvedValue({});
      mockScraperIntegrationService.checkScraperHealth.mockResolvedValue({ isHealthy: true });
      mockScraperIntegrationService.syncAll.mockResolvedValue({
        success: true,
        events: { usabmx: 0, uci: 0 },
        news: { usabmx: 0, uci: 0 },
        errors: []
      });

      await syncManagerService.executeSyncWithLogging();

      expect(mockPrismaClient.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scraperHealth: true
        })
      });
    });

    it('should return false when scraper health check fails', async () => {
      const mockSyncLog = { id: 1 };
      mockPrismaClient.syncLog.create.mockResolvedValue(mockSyncLog);
      mockPrismaClient.syncLog.update.mockResolvedValue({});
      mockScraperIntegrationService.checkScraperHealth.mockRejectedValue(new Error('Health check failed'));
      mockScraperIntegrationService.syncAll.mockResolvedValue({
        success: true,
        events: { usabmx: 0, uci: 0 },
        news: { usabmx: 0, uci: 0 },
        errors: []
      });

      await syncManagerService.executeSyncWithLogging();

      expect(mockPrismaClient.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scraperHealth: false
        })
      });
    });
  });

  describe('calculateNextRun (private method through upsertConfiguration)', () => {
    it('should calculate next daily run', async () => {
      const configData = {
        name: 'Daily Config',
        cronExpression: '0 2 * * *'
      };

      const mockConfig = { id: 1, name: 'Daily Config' };
      mockPrismaClient.syncConfiguration.upsert.mockResolvedValue(mockConfig);
      mockPrismaClient.syncSchedule.upsert.mockResolvedValue({});

      await syncManagerService.upsertConfiguration(configData);

      expect(mockPrismaClient.syncSchedule.upsert).toHaveBeenCalledWith({
        where: { configurationId: 1 },
        create: expect.objectContaining({
          cronExpression: '0 2 * * *',
          nextRun: expect.any(Date)
        }),
        update: expect.objectContaining({
          cronExpression: '0 2 * * *',
          nextRun: expect.any(Date)
        })
      });
    });

    it('should calculate next weekly run', async () => {
      const configData = {
        name: 'Weekly Config',
        cronExpression: '0 2 * * 0'
      };

      const mockConfig = { id: 2, name: 'Weekly Config' };
      mockPrismaClient.syncConfiguration.upsert.mockResolvedValue(mockConfig);
      mockPrismaClient.syncSchedule.upsert.mockResolvedValue({});

      await syncManagerService.upsertConfiguration(configData);

      expect(mockPrismaClient.syncSchedule.upsert).toHaveBeenCalled();
    });

    it('should handle cron expression with "daily" string', async () => {
      const configData = {
        name: 'Daily String Config',
        cronExpression: 'daily'
      };

      const mockConfig = { id: 3, name: 'Daily String Config' };
      mockPrismaClient.syncConfiguration.upsert.mockResolvedValue(mockConfig);
      mockPrismaClient.syncSchedule.upsert.mockResolvedValue({});

      await syncManagerService.upsertConfiguration(configData);

      expect(mockPrismaClient.syncSchedule.upsert).toHaveBeenCalled();
    });

    it('should handle cron expression with "weekly" string', async () => {
      const configData = {
        name: 'Weekly String Config',
        cronExpression: 'weekly'
      };

      const mockConfig = { id: 4, name: 'Weekly String Config' };
      mockPrismaClient.syncConfiguration.upsert.mockResolvedValue(mockConfig);
      mockPrismaClient.syncSchedule.upsert.mockResolvedValue({});

      await syncManagerService.upsertConfiguration(configData);

      expect(mockPrismaClient.syncSchedule.upsert).toHaveBeenCalled();
    });

    it('should use default calculation for unknown cron expressions', async () => {
      const configData = {
        name: 'Unknown Config',
        cronExpression: 'unknown-pattern'
      };

      const mockConfig = { id: 5, name: 'Unknown Config' };
      mockPrismaClient.syncConfiguration.upsert.mockResolvedValue(mockConfig);
      mockPrismaClient.syncSchedule.upsert.mockResolvedValue({});

      await syncManagerService.upsertConfiguration(configData);

      expect(mockPrismaClient.syncSchedule.upsert).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database errors gracefully in executeSyncWithLogging', async () => {
      mockPrismaClient.syncLog.create.mockRejectedValue(new Error('Database error'));

      await expect(syncManagerService.executeSyncWithLogging()).rejects.toThrow('Database error');
    });

    it('should handle undefined values in getSyncStatistics', async () => {
      const mockLogsWithNulls = [
        {
          id: 1,
          status: 'completed',
          eventsSynced: null,
          newsSynced: null,
          durationMs: null,
          startedAt: new Date()
        }
      ];

      mockPrismaClient.syncLog.findMany.mockResolvedValue(mockLogsWithNulls);

      const result = await syncManagerService.getSyncStatistics();

      expect(result.totalEvents).toBe(0);
      expect(result.totalNews).toBe(0);
      expect(result.successful).toBe(1);
    });

    it('should handle configuration upsert errors', async () => {
      const configData = { name: 'Error Config' };
      mockPrismaClient.syncConfiguration.upsert.mockRejectedValue(new Error('Upsert failed'));

      await expect(syncManagerService.upsertConfiguration(configData)).rejects.toThrow('Upsert failed');
    });

    it('should handle pagination edge cases', async () => {
      mockPrismaClient.syncLog.findMany.mockResolvedValue([]);
      mockPrismaClient.syncLog.count.mockResolvedValue(0);

      const result = await syncManagerService.getSyncLogs(1, 10);

      expect(result.pagination.pages).toBe(0);
      expect(result.logs).toEqual([]);
    });
  });
});
