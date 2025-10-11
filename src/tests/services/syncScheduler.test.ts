// Mock external dependencies
const mockCron = {
  validate: jest.fn(),
  schedule: jest.fn()
};

jest.mock('node-cron', () => mockCron);

// Mock Prisma Client
const mockPrisma = {
  syncConfiguration: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  syncSchedule: {
    update: jest.fn(),
    findUnique: jest.fn()
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

// Mock syncManagerService
const mockSyncManagerService = {
  executeSyncWithLogging: jest.fn()
};

jest.mock('../../services/syncManager.js', () => ({
  syncManagerService: mockSyncManagerService
}));

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

import { syncSchedulerService } from '../../services/syncScheduler';

describe('🕐 SyncScheduler Tests', () => {
  const originalConsole = console;
  let mockTask: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset service state
    syncSchedulerService.stopAll();
    // Force reset initialized state
    (syncSchedulerService as any).isInitialized = false;
    
    // Mock console methods
    console.log = mockConsole.log;
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;

    // Create mock task object
    mockTask = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
      getStatus: jest.fn().mockReturnValue('scheduled')
    };

    // Default mock implementations
    mockCron.validate.mockReturnValue(true);
    mockCron.schedule.mockReturnValue(mockTask);
    mockSyncManagerService.executeSyncWithLogging.mockResolvedValue({
      success: true,
      logId: 'test-log-123'
    });
  });

  afterAll(() => {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });

  describe('Initialization', () => {
    it('should initialize successfully with active configurations', async () => {
      const mockConfigurations = [
        {
          id: 1,
          name: 'Events Sync',
          isActive: true,
          autoSyncEnabled: true,
          syncEvents: true,
          syncNews: false,
          schedule: {
            cronExpression: '0 2 * * *',
            configurationId: 1
          }
        },
        {
          id: 2,
          name: 'News Sync',
          isActive: true,
          autoSyncEnabled: true,
          syncEvents: false,
          syncNews: true,
          schedule: {
            cronExpression: '0 3 * * *',
            configurationId: 2
          }
        }
      ];

      mockPrisma.syncConfiguration.findMany.mockResolvedValue(mockConfigurations);
      mockPrisma.syncSchedule.update.mockResolvedValue({});

      await syncSchedulerService.initialize();

      expect(mockConsole.log).toHaveBeenCalledWith('🚀 Initializing sync scheduler...');
      expect(mockConsole.log).toHaveBeenCalledWith('📋 Found 2 active configurations');
      expect(mockConsole.log).toHaveBeenCalledWith('✅ Sync scheduler initialized successfully');
      
      expect(mockPrisma.syncConfiguration.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          autoSyncEnabled: true
        },
        include: {
          schedule: true
        }
      });

      expect(mockCron.schedule).toHaveBeenCalledTimes(2);
    });

    it('should handle empty configurations gracefully', async () => {
      mockPrisma.syncConfiguration.findMany.mockResolvedValue([]);

      await syncSchedulerService.initialize();

      expect(mockConsole.log).toHaveBeenCalledWith('📋 Found 0 active configurations');
      expect(mockConsole.log).toHaveBeenCalledWith('✅ Sync scheduler initialized successfully');
      expect(mockCron.schedule).not.toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      mockPrisma.syncConfiguration.findMany.mockResolvedValue([]);
      
      await syncSchedulerService.initialize();
      mockConsole.log.mockClear();
      
      await syncSchedulerService.initialize();
      
      expect(mockConsole.log).toHaveBeenCalledWith('🔄 Sync scheduler already initialized');
      expect(mockPrisma.syncConfiguration.findMany).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors during initialization', async () => {
      const error = new Error('Database connection failed');
      mockPrisma.syncConfiguration.findMany.mockRejectedValue(error);

      await expect(syncSchedulerService.initialize()).rejects.toThrow('Database connection failed');
      
      expect(mockConsole.error).toHaveBeenCalledWith('❌ Error initializing sync scheduler:', error);
    });

    it('should skip configurations without schedule', async () => {
      const mockConfigurations = [
        {
          id: 1,
          name: 'Config without schedule',
          isActive: true,
          autoSyncEnabled: true,
          schedule: null
        }
      ];

      mockPrisma.syncConfiguration.findMany.mockResolvedValue(mockConfigurations);

      await syncSchedulerService.initialize();

      expect(mockCron.schedule).not.toHaveBeenCalled();
    });
  });

  describe('Task Scheduling', () => {
    it('should schedule a new task successfully', async () => {
      const configId = 1;
      const cronExpression = '0 2 * * *';

      mockPrisma.syncSchedule.update.mockResolvedValue({});

      await syncSchedulerService.scheduleTask(configId, cronExpression);

      expect(mockCron.validate).toHaveBeenCalledWith(cronExpression);
      expect(mockCron.schedule).toHaveBeenCalledWith(
        cronExpression,
        expect.any(Function),
        {
          scheduled: false,
          timezone: 'America/Mexico_City'
        }
      );
      expect(mockTask.start).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(`✅ Scheduled task created for configuration ${configId}: ${cronExpression}`);
    });

    it('should validate cron expression before scheduling', async () => {
      const configId = 1;
      const invalidCronExpression = 'invalid cron';

      mockCron.validate.mockReturnValue(false);

      await expect(syncSchedulerService.scheduleTask(configId, invalidCronExpression))
        .rejects.toThrow('Invalid cron expression: invalid cron');

      expect(mockCron.schedule).not.toHaveBeenCalled();
      expect(mockTask.start).not.toHaveBeenCalled();
    });

    it('should cancel existing task before scheduling new one', async () => {
      const configId = 1;
      const cronExpression = '0 2 * * *';

      mockPrisma.syncSchedule.update.mockResolvedValue({});

      // Schedule first task
      await syncSchedulerService.scheduleTask(configId, cronExpression);
      const firstTaskStart = mockTask.start;
      
      // Reset mock task for second scheduling
      const secondMockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
        getStatus: jest.fn().mockReturnValue('scheduled')
      };
      mockCron.schedule.mockReturnValue(secondMockTask);

      // Schedule second task (should cancel first)
      await syncSchedulerService.scheduleTask(configId, '0 3 * * *');

      expect(mockTask.stop).toHaveBeenCalled();
      expect(mockTask.destroy).toHaveBeenCalled();
      expect(secondMockTask.start).toHaveBeenCalled();
    });

    it('should handle database errors during task scheduling', async () => {
      const configId = 1;
      const cronExpression = '0 2 * * *';
      const error = new Error('Database update failed');

      mockPrisma.syncSchedule.update.mockRejectedValue(error);

      // updateNextRun error is caught and logged, task still gets scheduled
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error updating next run:',
        error
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        `✅ Scheduled task created for configuration ${configId}: ${cronExpression}`
      );
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel existing task successfully', async () => {
      const configId = 1;
      const cronExpression = '0 2 * * *';

      mockPrisma.syncSchedule.update.mockResolvedValue({});

      // First schedule a task
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      // Then cancel it
      syncSchedulerService.cancelTask(configId);

      expect(mockTask.stop).toHaveBeenCalled();
      expect(mockTask.destroy).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(`✅ Cancelled scheduled task for configuration ${configId}`);
    });

    it('should handle cancelling non-existent task gracefully', () => {
      const configId = 999;

      syncSchedulerService.cancelTask(configId);

      expect(mockTask.stop).not.toHaveBeenCalled();
      expect(mockTask.destroy).not.toHaveBeenCalled();
      // Should not log anything for non-existent tasks
    });
  });

  describe('Scheduled Sync Execution', () => {
    beforeEach(() => {
      // Reset the service state
      syncSchedulerService.stopAll();
    });

    it('should execute scheduled sync for events only', async () => {
      const configId = 1;
      const mockConfiguration = {
        id: configId,
        name: 'Events Only',
        isActive: true,
        autoSyncEnabled: true,
        syncEvents: true,
        syncNews: false,
        notificationsEnabled: false
      };

      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(mockConfiguration);
      mockPrisma.syncSchedule.update.mockResolvedValue({});
      mockSyncManagerService.executeSyncWithLogging.mockResolvedValue({
        success: true,
        logId: 'sync-log-123'
      });

      // Schedule task and execute it
      const cronExpression = '0 2 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      // Get the scheduled function and execute it
      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockSyncManagerService.executeSyncWithLogging).toHaveBeenCalledWith(
        'events',
        'scheduled',
        undefined,
        configId
      );

      expect(mockConsole.log).toHaveBeenCalledWith(
        `✅ Scheduled sync completed for configuration ${configId}:`,
        { success: true, logId: 'sync-log-123' }
      );
    });

    it('should execute scheduled sync for news only', async () => {
      const configId = 2;
      const mockConfiguration = {
        id: configId,
        name: 'News Only',
        isActive: true,
        autoSyncEnabled: true,
        syncEvents: false,
        syncNews: true,
        notificationsEnabled: false
      };

      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(mockConfiguration);
      mockPrisma.syncSchedule.update.mockResolvedValue({});

      const cronExpression = '0 3 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockSyncManagerService.executeSyncWithLogging).toHaveBeenCalledWith(
        'news',
        'scheduled',
        undefined,
        configId
      );
    });

    it('should execute scheduled sync for both events and news', async () => {
      const configId = 3;
      const mockConfiguration = {
        id: configId,
        name: 'Both Events and News',
        isActive: true,
        autoSyncEnabled: true,
        syncEvents: true,
        syncNews: true,
        notificationsEnabled: false
      };

      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(mockConfiguration);
      mockPrisma.syncSchedule.update.mockResolvedValue({});

      const cronExpression = '0 4 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockSyncManagerService.executeSyncWithLogging).toHaveBeenCalledWith(
        'all',
        'scheduled',
        undefined,
        configId
      );
    });

    it('should cancel task if configuration becomes inactive', async () => {
      const configId = 4;
      const inactiveConfiguration = {
        id: configId,
        isActive: false,
        autoSyncEnabled: true
      };

      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(inactiveConfiguration);

      const cronExpression = '0 5 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockConsole.log).toHaveBeenCalledWith(
        `⚠️ Configuration ${configId} is no longer active or auto-sync is disabled`
      );
      expect(mockSyncManagerService.executeSyncWithLogging).not.toHaveBeenCalled();
    });

    it('should handle sync execution errors gracefully', async () => {
      const configId = 5;
      const mockConfiguration = {
        id: configId,
        isActive: true,
        autoSyncEnabled: true,
        syncEvents: true,
        syncNews: true,
        notificationsEnabled: false
      };

      const syncError = new Error('Sync execution failed');
      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(mockConfiguration);
      mockSyncManagerService.executeSyncWithLogging.mockRejectedValue(syncError);

      const cronExpression = '0 6 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockConsole.error).toHaveBeenCalledWith(
        `❌ Error in scheduled sync for configuration ${configId}:`,
        syncError
      );
    });

    it('should send notification on sync failure when enabled', async () => {
      const configId = 6;
      const mockConfiguration = {
        id: configId,
        name: 'Notification Test',
        isActive: true,
        autoSyncEnabled: true,
        syncEvents: true,
        syncNews: false,
        notificationsEnabled: true,
        notificationEmail: 'admin@example.com'
      };

      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(mockConfiguration);
      mockPrisma.syncSchedule.update.mockResolvedValue({});
      mockSyncManagerService.executeSyncWithLogging.mockResolvedValue({
        success: false,
        logId: 'failed-sync-456'
      });

      const cronExpression = '0 7 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockConsole.log).toHaveBeenCalledWith(
        `📧 NOTIFICATION: Sync failed for configuration "${mockConfiguration.name}"`
      );
      expect(mockConsole.log).toHaveBeenCalledWith(`   Log ID: failed-sync-456`);
      expect(mockConsole.log).toHaveBeenCalledWith(`   Email: admin@example.com`);
    });
  });

  describe('Status and Management', () => {
    beforeEach(() => {
      syncSchedulerService.stopAll();
    });

    it('should return correct status for scheduled tasks', async () => {
      mockPrisma.syncSchedule.update.mockResolvedValue({});

      // Schedule multiple tasks
      await syncSchedulerService.scheduleTask(1, '0 2 * * *');
      await syncSchedulerService.scheduleTask(2, '0 3 * * *');

      const status = syncSchedulerService.getScheduledTasksStatus();

      expect(status.totalTasks).toBe(2);
      expect(status.initialized).toBe(false); // Not initialized via initialize()
      expect(status.tasks).toHaveLength(2);
      
      expect(status.tasks[0]).toEqual({
        configurationId: 1,
        cronExpression: '0 2 * * *',
        running: true
      });
    });

    it('should reload configurations correctly', async () => {
      mockPrisma.syncConfiguration.findMany.mockResolvedValue([]);
      
      // Schedule some tasks first
      await syncSchedulerService.scheduleTask(1, '0 2 * * *');
      expect(syncSchedulerService.getScheduledTasksStatus().totalTasks).toBe(1);

      // Reload configurations
      await syncSchedulerService.reloadConfigurations();

      expect(mockConsole.log).toHaveBeenCalledWith('🔄 Reloading sync configurations...');
      expect(mockTask.stop).toHaveBeenCalled();
      expect(mockTask.destroy).toHaveBeenCalled();
      expect(mockPrisma.syncConfiguration.findMany).toHaveBeenCalled();
    });

    it('should stop all tasks correctly', () => {
      // Schedule tasks
      syncSchedulerService.scheduleTask(1, '0 2 * * *');
      syncSchedulerService.scheduleTask(2, '0 3 * * *');

      // Stop all
      syncSchedulerService.stopAll();

      expect(mockConsole.log).toHaveBeenCalledWith('🛑 Stopping all scheduled tasks...');
      expect(mockConsole.log).toHaveBeenCalledWith('✅ All scheduled tasks stopped');
      expect(mockTask.stop).toHaveBeenCalledTimes(2);
      expect(mockTask.destroy).toHaveBeenCalledTimes(2);

      const status = syncSchedulerService.getScheduledTasksStatus();
      expect(status.totalTasks).toBe(0);
    });
  });

  describe('Next Run Calculation', () => {
    it('should calculate next run for daily sync', () => {
      const dailyCron = '0 2 * * *';
      const configId = 1;

      mockPrisma.syncSchedule.update.mockImplementation(({ data }) => {
        expect(data.nextRun).toBeInstanceOf(Date);
        return Promise.resolve({});
      });

      return syncSchedulerService.scheduleTask(configId, dailyCron);
    });

    it('should calculate next run for weekly sync', () => {
      const weeklyCron = '0 2 * * 0';
      const configId = 2;

      mockPrisma.syncSchedule.update.mockImplementation(({ data }) => {
        expect(data.nextRun).toBeInstanceOf(Date);
        return Promise.resolve({});
      });

      return syncSchedulerService.scheduleTask(configId, weeklyCron);
    });

    it('should handle database errors when updating next run', async () => {
      const configId = 1;
      const cronExpression = '0 2 * * *';
      
      mockPrisma.syncSchedule.update.mockRejectedValue(new Error('Update failed'));
      
      // updateNextRun errors are caught and logged, not thrown
      await syncSchedulerService.scheduleTask(configId, cronExpression);
        
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error updating next run:',
        expect.any(Error)
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        `✅ Scheduled task created for configuration ${configId}: ${cronExpression}`
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing configuration during execution', async () => {
      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(null);

      const configId = 999;
      const cronExpression = '0 8 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockConsole.log).toHaveBeenCalledWith(
        `⚠️ Configuration ${configId} is no longer active or auto-sync is disabled`
      );
    });

    it('should handle database errors during last run update gracefully', async () => {
      const configId = 1;
      const mockConfiguration = {
        id: configId,
        isActive: true,
        autoSyncEnabled: true,
        syncEvents: true,
        syncNews: false,
        notificationsEnabled: false
      };

      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(mockConfiguration);
      mockPrisma.syncSchedule.update
        .mockResolvedValueOnce({}) // First call for nextRun succeeds
        .mockRejectedValueOnce(new Error('Last run update failed')); // Second call fails

      const cronExpression = '0 9 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error updating last run:',
        expect.any(Error)
      );
    });

    it('should handle sync logging errors during error recovery', async () => {
      const configId = 1;
      const mockConfiguration = {
        id: configId,
        isActive: true,
        autoSyncEnabled: true,
        syncEvents: true,
        syncNews: false,
        notificationsEnabled: false
      };

      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(mockConfiguration);
      mockSyncManagerService.executeSyncWithLogging
        .mockRejectedValueOnce(new Error('Primary sync failed'))
        .mockRejectedValueOnce(new Error('Logging also failed'));

      const cronExpression = '0 10 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(mockConsole.error).toHaveBeenCalledWith(
        '❌ Error logging failed scheduled sync:',
        expect.any(Error)
      );
    });

    it('should not send notifications when disabled even on failure', async () => {
      const configId = 1;
      const mockConfiguration = {
        id: configId,
        name: 'No Notifications',
        isActive: true,
        autoSyncEnabled: true,
        syncEvents: true,
        syncNews: false,
        notificationsEnabled: false // Disabled
      };

      mockPrisma.syncConfiguration.findUnique.mockResolvedValue(mockConfiguration);
      mockPrisma.syncSchedule.update.mockResolvedValue({});
      mockSyncManagerService.executeSyncWithLogging.mockResolvedValue({
        success: false,
        logId: 'failed-but-no-notification'
      });

      const cronExpression = '0 11 * * *';
      await syncSchedulerService.scheduleTask(configId, cronExpression);

      const scheduledFunction = mockCron.schedule.mock.calls[0][1];
      await scheduledFunction();

      // Should not contain notification logs
      expect(mockConsole.log).not.toHaveBeenCalledWith(
        expect.stringContaining('📧 NOTIFICATION:')
      );
    });
  });
});
