import * as cron from 'node-cron';
import { syncManagerService } from './syncManager.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ScheduledTask {
  id: string;
  task: cron.ScheduledTask;
  configurationId: number;
  cronExpression: string;
}

class SyncSchedulerService {
  private scheduledTasks: Map<number, ScheduledTask> = new Map();
  private isInitialized = false;

  /**
   * Inicializa el scheduler cargando todas las configuraciones activas
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('🔄 Sync scheduler already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing sync scheduler...');
      
      // Cargar configuraciones activas con auto sync habilitado
      const activeConfigurations = await prisma.syncConfiguration.findMany({
        where: {
          isActive: true,
          autoSyncEnabled: true
        },
        include: {
          schedule: true
        }
      });

      console.log(`📋 Found ${activeConfigurations.length} active configurations`);

      // Crear tareas programadas para cada configuración
      for (const config of activeConfigurations) {
        if (config.schedule) {
          await this.scheduleTask(config.id, config.schedule.cronExpression);
        }
      }

      this.isInitialized = true;
      console.log('✅ Sync scheduler initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing sync scheduler:', error);
      throw error;
    }
  }

  /**
   * Programa una nueva tarea de sincronización
   */
  async scheduleTask(configurationId: number, cronExpression: string) {
    try {
      // Cancelar tarea existente si existe
      if (this.scheduledTasks.has(configurationId)) {
        this.cancelTask(configurationId);
      }

      // Validar expresión cron
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Crear nueva tarea
      const task = cron.schedule(cronExpression, async () => {
        console.log(`🔄 Executing scheduled sync for configuration ${configurationId}`);
        await this.executeScheduledSync(configurationId);
      }, {
        timezone: 'America/Mexico_City' // Ajustar según necesidades
      });

      // Almacenar referencia a la tarea
      const scheduledTask: ScheduledTask = {
        id: `config_${configurationId}`,
        task,
        configurationId,
        cronExpression
      };

      this.scheduledTasks.set(configurationId, scheduledTask);

      // Iniciar la tarea
      task.start();

      // Actualizar next_run en la base de datos
      await this.updateNextRun(configurationId, cronExpression);

      console.log(`✅ Scheduled task created for configuration ${configurationId}: ${cronExpression}`);
      
    } catch (error) {
      console.error(`❌ Error scheduling task for configuration ${configurationId}:`, error);
      throw error;
    }
  }

  /**
   * Cancela una tarea programada
   */
  cancelTask(configurationId: number) {
    const scheduledTask = this.scheduledTasks.get(configurationId);
    
    if (scheduledTask) {
      scheduledTask.task.stop();
      scheduledTask.task.destroy();
      this.scheduledTasks.delete(configurationId);
      
      console.log(`✅ Cancelled scheduled task for configuration ${configurationId}`);
    }
  }

  /**
   * Ejecuta sincronización programada
   */
  private async executeScheduledSync(configurationId: number) {
    try {
      const configuration = await prisma.syncConfiguration.findUnique({
        where: { id: configurationId }
      });

      if (!configuration || !configuration.isActive || !configuration.autoSyncEnabled) {
        console.log(`⚠️ Configuration ${configurationId} is no longer active or auto-sync is disabled`);
        this.cancelTask(configurationId);
        return;
      }

      // Determinar tipo de sincronización basado en la configuración
      let syncType = 'all';
      if (configuration.syncEvents && !configuration.syncNews) {
        syncType = 'events';
      } else if (!configuration.syncEvents && configuration.syncNews) {
        syncType = 'news';
      }

      // Ejecutar sincronización con logging
      const result = await syncManagerService.executeSyncWithLogging(
        syncType,
        'scheduled',
        undefined, // No user for scheduled sync
        configurationId
      );

      // Actualizar timestamp de última ejecución
      await this.updateLastRun(configurationId);

      console.log(`✅ Scheduled sync completed for configuration ${configurationId}:`, {
        success: result.success,
        logId: result.logId
      });

      // Enviar notificación si está habilitada y hay errores
      if (configuration.notificationsEnabled && !result.success) {
        await this.sendFailureNotification(configuration, result);
      }

    } catch (error) {
      console.error(`❌ Error in scheduled sync for configuration ${configurationId}:`, error);
      
      // Log del error
      try {
        await syncManagerService.executeSyncWithLogging(
          'all',
          'scheduled',
          undefined,
          configurationId
        );
      } catch (logError) {
        console.error('❌ Error logging failed scheduled sync:', logError);
      }
    }
  }

  /**
   * Actualiza la próxima ejecución programada
   */
  private async updateNextRun(configurationId: number, cronExpression: string) {
    try {
      // Calcular próxima ejecución (implementación básica)
      const nextRun = this.calculateNextRun(cronExpression);
      
      await prisma.syncSchedule.update({
        where: { configurationId },
        data: { nextRun }
      });
    } catch (error) {
      console.error('Error updating next run:', error);
    }
  }

  /**
   * Actualiza timestamp de última ejecución
   */
  private async updateLastRun(configurationId: number) {
    try {
      const nextRun = await this.calculateNextRunForConfig(configurationId);
      await prisma.syncSchedule.update({
        where: { configurationId },
        data: { 
          lastRun: new Date(),
          nextRun
        }
      });
    } catch (error) {
      console.error('Error updating last run:', error);
    }
  }

  /**
   * Calcula próxima ejecución para una configuración específica
   */
  private async calculateNextRunForConfig(configurationId: number): Promise<Date | null> {
    try {
      const schedule = await prisma.syncSchedule.findUnique({
        where: { configurationId }
      });
      
      return schedule ? this.calculateNextRun(schedule.cronExpression) : null;
    } catch (error) {
      console.error('Error calculating next run:', error);
      return null;
    }
  }

  /**
   * Calcula próxima ejecución basada en expresión cron
   */
  private calculateNextRun(cronExpression: string): Date {
    const now = new Date();
    const next = new Date(now);
    
    // Implementación básica - en producción usar librería como 'cron-parser'
    // Por ahora agregamos 24 horas para daily, 7 días para weekly, etc.
    if (cronExpression.includes('0 2 * * *') || cronExpression.includes('0 3 * * *')) {
      // Daily sync
      next.setDate(next.getDate() + 1);
    } else if (cronExpression.includes('0 2 * * 0')) {
      // Weekly sync (Sundays)
      next.setDate(next.getDate() + 7);
    } else {
      // Default: next day
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }

  /**
   * Envía notificación de error
   */
  private async sendFailureNotification(configuration: any, result: any) {
    // Implementación básica de notificación
    // En producción se integraría con servicio de email, Slack, etc.
    console.log(`📧 NOTIFICATION: Sync failed for configuration "${configuration.name}"`);
    console.log(`   Log ID: ${result.logId}`);
    console.log(`   Email: ${configuration.notificationEmail || 'Not configured'}`);
  }

  /**
   * Obtiene estado de todas las tareas programadas
   */
  getScheduledTasksStatus() {
    const tasks: any[] = [];
    
    this.scheduledTasks.forEach((task, configId) => {
      tasks.push({
        configurationId: configId,
        cronExpression: task.cronExpression,
        running: task.task.getStatus() === 'scheduled'
      });
    });

    return {
      totalTasks: tasks.length,
      initialized: this.isInitialized,
      tasks
    };
  }

  /**
   * Recarga configuraciones desde la base de datos
   */
  async reloadConfigurations() {
    console.log('🔄 Reloading sync configurations...');
    
    // Cancelar todas las tareas existentes
    this.scheduledTasks.forEach((_, configId) => {
      this.cancelTask(configId);
    });

    // Reinicializar
    this.isInitialized = false;
    await this.initialize();
  }

  /**
   * Detiene todas las tareas programadas
   */
  stopAll() {
    console.log('🛑 Stopping all scheduled tasks...');
    
    this.scheduledTasks.forEach((_, configId) => {
      this.cancelTask(configId);
    });

    this.isInitialized = false;
    console.log('✅ All scheduled tasks stopped');
  }
}

export const syncSchedulerService = new SyncSchedulerService();
