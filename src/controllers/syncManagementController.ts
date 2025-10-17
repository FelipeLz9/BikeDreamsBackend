import { syncManagerService } from '../services/syncManager';
import { ApiResponse, createErrorResponse, createSuccessResponse } from '../utils/apiResponse';

/**
 * Ejecuta sincronización con logging avanzado
 */
export async function executeAdvancedSync(
  syncType?: string,
  triggeredBy?: number
): Promise<ApiResponse> {
  try {
    const result = await syncManagerService.executeSyncWithLogging(
      syncType || 'all',
      'manual',
      triggeredBy
    );

    return createSuccessResponse(
      result,
      `Sincronización ${result.success ? 'completada' : 'falló'}. Log ID: ${result.logId}`
    );
  } catch (error) {
    return createErrorResponse('Error ejecutando sincronización avanzada', String(error));
  }
}

/**
 * Obtiene estadísticas de sincronización
 */
export async function getSyncStatistics(days?: number): Promise<ApiResponse> {
  try {
    const stats = await syncManagerService.getSyncStatistics(days || 30);
    return createSuccessResponse(stats, 'Estadísticas obtenidas exitosamente');
  } catch (error) {
    return createErrorResponse('Error obteniendo estadísticas', String(error));
  }
}

/**
 * Obtiene logs de sincronización con paginación
 */
export async function getSyncLogs(
  page?: number,
  limit?: number,
  status?: string
): Promise<ApiResponse> {
  try {
    const result = await syncManagerService.getSyncLogs(
      page || 1,
      limit || 20,
      status
    );
    return createSuccessResponse(result, 'Logs obtenidos exitosamente');
  } catch (error) {
    return createErrorResponse('Error obteniendo logs', String(error));
  }
}

/**
 * Obtiene configuraciones de sincronización
 */
export async function getSyncConfigurations(): Promise<ApiResponse> {
  try {
    const configurations = await syncManagerService.getConfigurations();
    return createSuccessResponse(configurations, 'Configuraciones obtenidas exitosamente');
  } catch (error) {
    return createErrorResponse('Error obteniendo configuraciones', String(error));
  }
}

/**
 * Crea o actualiza configuración de sincronización
 */
export async function upsertSyncConfiguration(data: {
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
}): Promise<ApiResponse> {
  try {
    // Validaciones básicas
    if (!data.name || data.name.trim().length === 0) {
      return createErrorResponse('El nombre de la configuración es requerido');
    }

    if (data.syncFrequency && !['daily', 'weekly', 'hourly', 'custom'].includes(data.syncFrequency)) {
      return createErrorResponse('Frecuencia de sincronización inválida');
    }

    if (data.syncTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.syncTime)) {
      return createErrorResponse('Formato de hora inválido (use HH:MM)');
    }

    const configuration = await syncManagerService.upsertConfiguration(data);
    
    return createSuccessResponse(
      configuration, 
      'Configuración guardada exitosamente'
    );
  } catch (error) {
    return createErrorResponse('Error guardando configuración', String(error));
  }
}

/**
 * Activa o desactiva configuración de sincronización
 */
export async function toggleSyncConfiguration(
  id: number,
  isActive: boolean
): Promise<ApiResponse> {
  try {
    if (!id || id <= 0) {
      return createErrorResponse('ID de configuración inválido');
    }

    const configuration = await syncManagerService.toggleConfiguration(id, isActive);
    
    return createSuccessResponse(
      configuration,
      `Configuración ${isActive ? 'activada' : 'desactivada'} exitosamente`
    );
  } catch (error) {
    return createErrorResponse('Error actualizando configuración', String(error));
  }
}

/**
 * Obtiene configuración activa para sincronización automática
 */
export async function getActiveConfiguration(): Promise<ApiResponse> {
  try {
    const configuration = await syncManagerService.getActiveConfiguration();
    
    if (!configuration) {
      return createSuccessResponse(
        null, 
        'No hay configuración activa para sincronización automática'
      );
    }
    
    return createSuccessResponse(configuration, 'Configuración activa obtenida');
  } catch (error) {
    return createErrorResponse('Error obteniendo configuración activa', String(error));
  }
}

/**
 * Obtiene resumen del dashboard de sincronización
 */
export async function getSyncDashboard(): Promise<ApiResponse> {
  try {
    const [stats, activeConfig, recentLogs] = await Promise.all([
      syncManagerService.getSyncStatistics(7), // Última semana
      syncManagerService.getActiveConfiguration(),
      syncManagerService.getSyncLogs(1, 5) // Últimos 5 logs
    ]);

    const dashboard = {
      weeklyStats: stats,
      activeConfiguration: activeConfig,
      recentActivity: recentLogs.logs,
      systemStatus: {
        autoSyncEnabled: activeConfig?.autoSyncEnabled || false,
        lastSync: recentLogs.logs[0]?.startedAt || null,
        nextScheduledSync: activeConfig?.schedule?.nextRun || null
      }
    };

    return createSuccessResponse(dashboard, 'Dashboard obtenido exitosamente');
  } catch (error) {
    return createErrorResponse('Error obteniendo dashboard', String(error));
  }
}
