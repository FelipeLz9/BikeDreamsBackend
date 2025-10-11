import { PrismaClient } from '@prisma/client';
import { scraperIntegrationService } from './scraperIntegration.js';

const prisma = new PrismaClient();

interface SyncResult {
  success: boolean;
  events: { usabmx: number; uci: number };
  news: { usabmx: number; uci: number };
  errors: string[];
}

class SyncManagerService {
  
  /**
   * Ejecuta sincronización con logging completo
   */
  async executeSyncWithLogging(
    syncType: string = 'all',
    triggerType: string = 'manual',
    triggeredBy?: number,
    configurationId?: number
  ): Promise<{ success: boolean; logId: number; result?: SyncResult }> {
    
    const startTime = Date.now();
    
    // Crear log de inicio
    const syncLog = await prisma.syncLog.create({
      data: {
        syncType,
        triggerType,
        status: 'running',
        triggeredBy,
        configurationId,
        scraperHealth: await this.checkScraperHealth()
      }
    });
    
    try {
      let result: SyncResult;
      
      // Ejecutar sincronización según el tipo
      switch (syncType) {
        case 'events':
          const eventsResult = await scraperIntegrationService.syncEvents();
          result = {
            success: eventsResult.success,
            events: { usabmx: eventsResult.usabmx, uci: eventsResult.uci },
            news: { usabmx: 0, uci: 0 },
            errors: eventsResult.errors
          };
          break;
        case 'news':
          const newsResult = await scraperIntegrationService.syncNews();
          result = {
            success: newsResult.success,
            events: { usabmx: 0, uci: 0 },
            news: { usabmx: newsResult.usabmx, uci: newsResult.uci },
            errors: newsResult.errors
          };
          break;
        default:
          result = await scraperIntegrationService.syncAll();
      }
      
      const duration = Date.now() - startTime;
      
      // Actualizar log con resultados
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: result.success ? 'completed' : 'failed',
          completedAt: new Date(),
          durationMs: duration,
          eventsUsabmx: result.events.usabmx,
          eventsUci: result.events.uci,
          newsUsabmx: result.news.usabmx,
          newsUci: result.news.uci,
          eventsSynced: result.events.usabmx + result.events.uci,
          newsSynced: result.news.usabmx + result.news.uci,
          totalErrors: result.errors.length,
          errorDetails: result.errors
        }
      });
      
      console.log(`✅ Sync ${syncLog.id} completed in ${duration}ms`);
      
      return { success: result.success, logId: syncLog.id, result };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Actualizar log con error
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          durationMs: duration,
          totalErrors: 1,
          errorDetails: [String(error)]
        }
      });
      
      console.error(`❌ Sync ${syncLog.id} failed:`, error);
      
      return { success: false, logId: syncLog.id };
    }
  }
  
  /**
   * Obtiene configuración de sincronización activa
   */
  async getActiveConfiguration() {
    return await prisma.syncConfiguration.findFirst({
      where: { 
        isActive: true,
        autoSyncEnabled: true
      },
      include: {
        schedule: true
      }
    });
  }
  
  /**
   * Crea o actualiza configuración de sincronización
   */
  async upsertConfiguration(data: {
    name: string;
    description?: string;
    syncFrequency?: string;
    syncTime?: string;
    syncEvents?: boolean;
    syncNews?: boolean;
    syncUsabmx?: boolean;
    syncUci?: boolean;
    autoSyncEnabled?: boolean;
    notificationsEnabled?: boolean;
    notificationEmail?: string;
    maxRetries?: number;
    timeoutMinutes?: number;
    cronExpression?: string;
    createdBy?: number;
  }) {
    
    const configuration = await prisma.syncConfiguration.upsert({
      where: { name: data.name },
      create: {
        name: data.name,
        description: data.description,
        syncFrequency: data.syncFrequency || 'daily',
        syncTime: data.syncTime || '02:00',
        syncEvents: data.syncEvents ?? true,
        syncNews: data.syncNews ?? true,
        syncUsabmx: data.syncUsabmx ?? true,
        syncUci: data.syncUci ?? true,
        autoSyncEnabled: data.autoSyncEnabled ?? false,
        notificationsEnabled: data.notificationsEnabled ?? true,
        notificationEmail: data.notificationEmail,
        maxRetries: data.maxRetries || 3,
        timeoutMinutes: data.timeoutMinutes || 30,
        createdBy: data.createdBy
      },
      update: {
        description: data.description,
        syncFrequency: data.syncFrequency,
        syncTime: data.syncTime,
        syncEvents: data.syncEvents,
        syncNews: data.syncNews,
        syncUsabmx: data.syncUsabmx,
        syncUci: data.syncUci,
        autoSyncEnabled: data.autoSyncEnabled,
        notificationsEnabled: data.notificationsEnabled,
        notificationEmail: data.notificationEmail,
        maxRetries: data.maxRetries,
        timeoutMinutes: data.timeoutMinutes,
        updatedAt: new Date()
      }
    });
    
    // Crear o actualizar schedule si se proporciona cronExpression
    if (data.cronExpression) {
      await prisma.syncSchedule.upsert({
        where: { configurationId: configuration.id },
        create: {
          configurationId: configuration.id,
          cronExpression: data.cronExpression,
          nextRun: this.calculateNextRun(data.cronExpression)
        },
        update: {
          cronExpression: data.cronExpression,
          nextRun: this.calculateNextRun(data.cronExpression),
          updatedAt: new Date()
        }
      });
    }
    
    return configuration;
  }
  
  /**
   * Obtiene estadísticas de sincronización
   */
  async getSyncStatistics(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const logs = await prisma.syncLog.findMany({
      where: {
        startedAt: {
          gte: startDate
        }
      },
      orderBy: {
        startedAt: 'desc'
      }
    });
    
    const successful = logs.filter(log => log.status === 'completed').length;
    const failed = logs.filter(log => log.status === 'failed').length;
    const totalEvents = logs.reduce((sum, log) => sum + (log.eventsSynced || 0), 0);
    const totalNews = logs.reduce((sum, log) => sum + (log.newsSynced || 0), 0);
    const avgDuration = logs
      .filter(log => log.durationMs)
      .reduce((sum, log, _, arr) => sum + (log.durationMs! / arr.length), 0);
    
    return {
      period: `Last ${days} days`,
      totalSyncs: logs.length,
      successful,
      failed,
      successRate: logs.length > 0 ? (successful / logs.length) * 100 : 0,
      totalEvents,
      totalNews,
      averageDurationMs: Math.round(avgDuration),
      recentLogs: logs.slice(0, 10)
    };
  }
  
  /**
   * Obtiene logs de sincronización con paginación
   */
  async getSyncLogs(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;
    
    const where = status ? { status } : {};
    
    const [logs, total] = await Promise.all([
      prisma.syncLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          configuration: {
            select: { name: true }
          }
        }
      }),
      prisma.syncLog.count({ where })
    ]);
    
    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * Obtiene configuraciones disponibles
   */
  async getConfigurations() {
    return await prisma.syncConfiguration.findMany({
      include: {
        schedule: true,
        _count: {
          select: { logs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  /**
   * Activa/desactiva configuración
   */
  async toggleConfiguration(id: number, isActive: boolean) {
    return await prisma.syncConfiguration.update({
      where: { id },
      data: { 
        isActive,
        updatedAt: new Date()
      }
    });
  }
  
  /**
   * Verifica salud del scraper
   */
  private async checkScraperHealth(): Promise<boolean> {
    try {
      const health = await scraperIntegrationService.checkScraperHealth();
      return health.isHealthy;
    } catch {
      return false;
    }
  }
  
  /**
   * Calcula próxima ejecución basada en cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    // Por ahora implementamos lógica básica para frecuencias comunes
    // En producción se podría usar una librería como 'node-cron' o 'cron-parser'
    const now = new Date();
    const next = new Date(now);
    
    // Ejemplos básicos
    if (cronExpression.includes('daily') || cronExpression === '0 2 * * *') {
      next.setDate(next.getDate() + 1);
      next.setHours(2, 0, 0, 0);
    } else if (cronExpression.includes('weekly') || cronExpression === '0 2 * * 0') {
      next.setDate(next.getDate() + 7);
      next.setHours(2, 0, 0, 0);
    } else {
      // Default: siguiente día a las 2 AM
      next.setDate(next.getDate() + 1);
      next.setHours(2, 0, 0, 0);
    }
    
    return next;
  }
}

export const syncManagerService = new SyncManagerService();
