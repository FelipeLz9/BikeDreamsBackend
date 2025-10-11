import { syncSchedulerService } from '../services/syncScheduler.js';
import { syncManagerService } from '../services/syncManager.js';
import { ApiResponse, createErrorResponse, createSuccessResponse } from '../utils/apiResponse.js';

/**
 * Inicializa el sistema de sincronización automática
 */
export async function initializeAutoSync(): Promise<ApiResponse> {
  try {
    await syncSchedulerService.initialize();
    return createSuccessResponse(
      { initialized: true },
      'Sistema de sincronización automática inicializado'
    );
  } catch (error) {
    return createErrorResponse('Error inicializando sincronización automática', String(error));
  }
}

/**
 * Activa la sincronización automática para una configuración
 */
export async function enableAutoSync(data: {
  configurationId: number;
  cronExpression?: string;
  autoSyncEnabled?: boolean;
}): Promise<ApiResponse> {
  try {
    const { configurationId, cronExpression, autoSyncEnabled = true } = data;

    if (!configurationId || configurationId <= 0) {
      return createErrorResponse('ID de configuración inválido');
    }

    // Actualizar configuración para habilitar auto sync
    await syncManagerService.upsertConfiguration({
      name: `temp_config_${configurationId}`, // Será sobrescrito
      autoSyncEnabled,
      cronExpression
    });

    // Si se proporciona nueva expresión cron, programar tarea
    if (cronExpression && autoSyncEnabled) {
      await syncSchedulerService.scheduleTask(configurationId, cronExpression);
    } else if (!autoSyncEnabled) {
      // Cancelar tarea si se desactiva
      syncSchedulerService.cancelTask(configurationId);
    }

    // Recargar configuraciones
    await syncSchedulerService.reloadConfigurations();

    return createSuccessResponse(
      { 
        configurationId,
        autoSyncEnabled,
        cronExpression: cronExpression || null
      },
      `Sincronización automática ${autoSyncEnabled ? 'habilitada' : 'deshabilitada'}`
    );
  } catch (error) {
    return createErrorResponse('Error configurando sincronización automática', String(error));
  }
}

/**
 * Obtiene el estado del sistema de sincronización automática
 */
export async function getAutoSyncStatus(): Promise<ApiResponse> {
  try {
    const [schedulerStatus, activeConfig] = await Promise.all([
      syncSchedulerService.getScheduledTasksStatus(),
      syncManagerService.getActiveConfiguration()
    ]);

    const status = {
      scheduler: schedulerStatus,
      activeConfiguration: activeConfig,
      systemStatus: {
        hasActiveTasks: schedulerStatus.totalTasks > 0,
        schedulerInitialized: schedulerStatus.initialized,
        autoSyncConfigured: !!activeConfig
      }
    };

    return createSuccessResponse(status, 'Estado de sincronización automática obtenido');
  } catch (error) {
    return createErrorResponse('Error obteniendo estado de sincronización automática', String(error));
  }
}

/**
 * Recarga las configuraciones de sincronización automática
 */
export async function reloadAutoSyncConfigurations(): Promise<ApiResponse> {
  try {
    await syncSchedulerService.reloadConfigurations();
    
    const status = syncSchedulerService.getScheduledTasksStatus();
    
    return createSuccessResponse(
      status,
      'Configuraciones de sincronización recargadas'
    );
  } catch (error) {
    return createErrorResponse('Error recargando configuraciones', String(error));
  }
}

/**
 * Detiene todas las tareas de sincronización automática
 */
export async function stopAllAutoSync(): Promise<ApiResponse> {
  try {
    syncSchedulerService.stopAll();
    
    return createSuccessResponse(
      { stopped: true },
      'Todas las tareas de sincronización automática detenidas'
    );
  } catch (error) {
    return createErrorResponse('Error deteniendo tareas automáticas', String(error));
  }
}

/**
 * Programa una nueva tarea de sincronización
 */
export async function scheduleSync(data: {
  configurationId: number;
  cronExpression: string;
}): Promise<ApiResponse> {
  try {
    const { configurationId, cronExpression } = data;

    if (!configurationId || configurationId <= 0) {
      return createErrorResponse('ID de configuración inválido');
    }

    if (!cronExpression || cronExpression.trim().length === 0) {
      return createErrorResponse('Expresión cron es requerida');
    }

    await syncSchedulerService.scheduleTask(configurationId, cronExpression);
    
    return createSuccessResponse(
      { 
        configurationId,
        cronExpression,
        scheduled: true
      },
      'Tarea de sincronización programada exitosamente'
    );
  } catch (error) {
    return createErrorResponse('Error programando tarea de sincronización', String(error));
  }
}

/**
 * Cancela una tarea de sincronización programada
 */
export async function cancelScheduledSync(configurationId: number): Promise<ApiResponse> {
  try {
    if (!configurationId || configurationId <= 0) {
      return createErrorResponse('ID de configuración inválido');
    }

    syncSchedulerService.cancelTask(configurationId);
    
    return createSuccessResponse(
      { 
        configurationId,
        cancelled: true
      },
      'Tarea de sincronización cancelada'
    );
  } catch (error) {
    return createErrorResponse('Error cancelando tarea programada', String(error));
  }
}

/**
 * Ejecuta una prueba de sincronización programada
 */
export async function testScheduledSync(configurationId: number): Promise<ApiResponse> {
  try {
    if (!configurationId || configurationId <= 0) {
      return createErrorResponse('ID de configuración inválido');
    }

    const result = await syncManagerService.executeSyncWithLogging(
      'all',
      'test',
      undefined,
      configurationId
    );

    return createSuccessResponse(
      {
        testResult: result,
        message: 'Prueba de sincronización completada'
      },
      result.success 
        ? 'Prueba de sincronización exitosa' 
        : 'Prueba de sincronización con errores'
    );
  } catch (error) {
    return createErrorResponse('Error en prueba de sincronización', String(error));
  }
}
